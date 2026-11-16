import type {
  PriceServiceRequestDto,
  SubmitServiceRequestDto,
  UpdateServiceRequestStatusDto,
  UpsertServiceDto,
} from '$lib/remotes/dtos/service.dto';
import { NotFoundError, UserError } from '$lib/errors';
import { BaseService } from '$lib/server/services/base.service';
import type { Payment, Service, ServiceRequest } from '$lib/server/db/schema';
import { SENDERS } from '$lib/server/utils/email-templates/senders';
import { sendTemplate } from '$lib/server/utils/email';
import { payUrl } from '$lib/server/utils/payment-links';
import { forEachSettled, runInBackground } from '$lib/server/utils/background';
import { sendOnce } from '$lib/server/utils/reminders';
import { readyPaymentNote, releasePayment, type WorkOrder } from '$lib/server/utils/work-order';
import { fileUrl } from '$lib/server/utils/storage';
import { buildBill, PAYMENT_STATUS, PAYMENT_TYPE, type PaymentStatus } from '$lib/utils/billing';
import {
  answersProblem,
  formAnswers,
  isUnpaid,
  quoteRequired,
  SERVICE_FIELD_TYPE,
  SERVICE_PRICING,
  SERVICE_REQUEST_STATUS,
  type ServiceAnswers,
} from '$lib/utils/services';
import { DateTime, Duration } from 'luxon';
import { posix } from 'node:path';

const SERVICE_NOT_FOUND_MESSAGE = 'Service not found';
const REQUEST_NOT_FOUND_MESSAGE = 'Service request not found';
const CLOSED_PAYMENT_STATUSES: PaymentStatus[] = [PAYMENT_STATUS.CANCELED, PAYMENT_STATUS.REFUNDED];
const PICKUP_REMINDER_DELAY = Duration.fromObject({ days: 3 });

/** One line for the service, so the checkout page names what is being paid for. */
function serviceBill(service: Pick<Service, 'name'>, price: number) {
  return buildBill([{ name: service.name, quantity: 1, unitAmount: price }]);
}

function workOrder(
  request: Pick<ServiceRequest, 'email' | 'customerName'>,
  serviceName: string,
  payment: Payment,
): WorkOrder {
  return {
    email: request.email,
    customerName: request.customerName,
    itemName: serviceName,
    sender: SENDERS.foundry,
    link: payUrl(payment),
  };
}

export class ServiceRequestError extends UserError {}

export class ServiceService extends BaseService {
  // ── Catalog ──

  async upsertService({ id, ...fields }: UpsertServiceDto) {
    // Variable services are priced per request, so a stray fixed price is dropped.
    const data = {
      ...fields,
      price: fields.pricingMode === SERVICE_PRICING.FIXED ? fields.price : 0,
    };
    if (!id) return await this.serviceRepository.create(data);

    const updated = await this.serviceRepository.update(id, data);
    if (!updated) throw new NotFoundError(SERVICE_NOT_FOUND_MESSAGE);
    return updated;
  }

  async getAllServices() {
    return await this.serviceRepository.getAll();
  }

  async getEnabledServices() {
    return await this.serviceRepository.getEnabled();
  }

  /** Disabled services are hidden from the public form. */
  async getEnabledService(id: string) {
    const service = await this.serviceRepository.getById(id);
    return service?.enabled ? service : null;
  }

  // ── Request ──

  async submitRequest(dto: SubmitServiceRequestDto) {
    const service = await this.getEnabledService(dto.serviceId);
    if (!service) throw new NotFoundError('This service is not available');

    const submitted = dto.answers ?? {};
    const problem = answersProblem(service.fields, submitted);
    if (problem) throw new ServiceRequestError(problem);

    // Files are stored under the request's id, so the id is chosen before the insert.
    const requestId = crypto.randomUUID();
    const answers: ServiceAnswers = {};
    for (const [fieldId, answer] of Object.entries(formAnswers(service.fields, submitted))) {
      answers[fieldId] =
        answer instanceof File
          ? await this.serviceRepository.uploadRequestFile(requestId, fieldId, answer)
          : answer;
    }

    // Fixed prices are billed now; variable ones start as an empty quote for staff to price.
    const fixed = service.pricingMode === SERVICE_PRICING.FIXED;
    const payment = await this.paymentRepository.save({
      type: PAYMENT_TYPE.SERVICE_REQUEST,
      status: fixed ? PAYMENT_STATUS.PENDING : PAYMENT_STATUS.QUOTE,
      customer: { name: dto.customerName, email: dto.email },
      bill: fixed ? serviceBill(service, service.price) : buildBill([]),
    });

    await this.serviceRepository.createRequest({
      id: requestId,
      serviceId: service.id,
      fields: service.fields,
      customerName: dto.customerName,
      email: dto.email,
      answers,
      paymentId: payment.id,
      status: SERVICE_REQUEST_STATUS.SUBMITTED,
    });
    return {
      pricingMode: service.pricingMode,
      price: payment.total,
      paymentId: payment.id,
    };
  }

  async getRequests() {
    const rows = await this.serviceRepository.getRequests();
    // File answers are storage keys; staff get a signed link and the original file name.
    return rows.map((row) => ({
      ...row,
      files: Object.fromEntries(
        row.request.fields
          .filter((field) => field.type === SERVICE_FIELD_TYPE.FILE)
          .flatMap((field) => {
            const key = row.request.answers[field.id];
            return typeof key === 'string'
              ? [[field.id, { name: posix.basename(key), url: fileUrl(key) }]]
              : [];
          }),
      ),
    }));
  }

  private async requireRequest(id: string) {
    const request = await this.serviceRepository.getRequestById(id);
    if (!request) throw new NotFoundError(REQUEST_NOT_FOUND_MESSAGE);
    return request;
  }

  async updateRequestStatus({ id, status }: UpdateServiceRequestStatusDto) {
    const { request, serviceName, payment } = await this.requireRequest(id);
    if (quoteRequired(payment, status)) {
      throw new ServiceRequestError('Send a quote before starting work.');
    }
    // A canceled or refunded bill cannot be paid again, so the request can only end up canceled.
    const isReopening = status !== request.status && status !== SERVICE_REQUEST_STATUS.CANCELED;
    if (isReopening && CLOSED_PAYMENT_STATUSES.includes(payment.status)) {
      throw new ServiceRequestError('This request was canceled and cannot be reopened.');
    }
    if (status === request.status) return request;

    if (status === SERVICE_REQUEST_STATUS.PICKED_UP && payment.status !== PAYMENT_STATUS.PAID) {
      throw new ServiceRequestError('Collect payment before marking it picked up.');
    }
    if (status === SERVICE_REQUEST_STATUS.CANCELED) {
      await releasePayment(this, payment);
    }

    const isUndoingPickup = request.status === SERVICE_REQUEST_STATUS.PICKED_UP;
    if (status === SERVICE_REQUEST_STATUS.DONE && !isUndoingPickup) {
      const updated = await this.serviceRepository.updateRequest(id, {
        status,
        completionDate: DateTime.now(),
      });
      runInBackground(
        this.emailReady(workOrder(request, serviceName, payment), payment),
        'send service ready email',
      );
      return updated;
    }

    return await this.serviceRepository.updateRequest(id, { status });
  }

  /** Reminds the customer that a finished request is waiting for pickup. */
  async sendReadyEmail(id: string) {
    const { request, serviceName, payment } = await this.requireRequest(id);
    if (request.status !== SERVICE_REQUEST_STATUS.DONE) {
      throw new ServiceRequestError('Only finished requests are ready for pickup.');
    }
    await this.emailReady(workOrder(request, serviceName, payment), payment);
  }

  private async emailReady(order: WorkOrder, payment: Payment) {
    await sendTemplate(this, order.email, order.sender, 'service_ready', {
      customerName: order.customerName,
      serviceName: order.itemName,
      paymentNote: readyPaymentNote(payment),
      paymentUrl: order.link,
    });
  }

  /** Re-sends the ready email for requests left waiting for pickup. It also says what is owed. */
  async sendDueReminders(now: DateTime = DateTime.now()) {
    const pickups = await this.serviceRepository.getPickupReminderCandidates(
      now.minus(PICKUP_REMINDER_DELAY),
    );

    await forEachSettled(
      pickups,
      ({ request, serviceName, payment }) =>
        sendOnce(
          {
            claim: () => this.serviceRepository.claimPickupReminder(request.id, now),
            release: () => this.serviceRepository.releasePickupReminder(request.id),
          },
          () => this.emailReady(workOrder(request, serviceName, payment), payment),
        ),
      ({ request }) => `send pickup reminder for service request ${request.id}`,
    );
  }

  /** Sets a variable request's price. The customer then pays it at /pay/[id]. */
  async priceRequest({ id, price }: PriceServiceRequestDto) {
    const { request, serviceName, pricingMode, payment } = await this.requireRequest(id);
    if (pricingMode !== SERVICE_PRICING.VARIABLE) {
      throw new ServiceRequestError('Fixed-price requests cannot be quoted.');
    }
    if (!isUnpaid(payment)) {
      throw new ServiceRequestError('Only unpaid requests can be quoted.');
    }
    // Services have no approval step: the quote is the bill.
    return await this.paymentRepository.save(
      {
        type: PAYMENT_TYPE.SERVICE_REQUEST,
        status: PAYMENT_STATUS.PENDING,
        customer: { name: request.customerName, email: request.email },
        bill: serviceBill({ name: serviceName }, price),
      },
      payment.id,
    );
  }
}

export const serviceService = new ServiceService();
