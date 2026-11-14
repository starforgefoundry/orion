import type {
  PriceServiceRequestDto,
  SubmitServiceRequestDto,
  UpdateServiceRequestStatusDto,
  UpsertServiceDto,
} from '$lib/remotes/dtos/service.dto';
import { NotFoundError, UserError } from '$lib/errors';
import { BaseService } from '$lib/server/services/base.service';
import type { Service } from '$lib/server/db/schema';
import { fileUrl } from '$lib/server/utils/storage';
import { buildBill, PAYMENT_STATUS, PAYMENT_TYPE } from '$lib/utils/billing';
import {
  answersProblem,
  formAnswers,
  isCancelable,
  isUnpaid,
  quoteRequired,
  SERVICE_FIELD_TYPE,
  SERVICE_PRICING,
  SERVICE_REQUEST_STATUS,
  type ServiceAnswers,
} from '$lib/utils/services';
import { posix } from 'node:path';

const SERVICE_NOT_FOUND_MESSAGE = 'Service not found';
const REQUEST_NOT_FOUND_MESSAGE = 'Service request not found';

/** One line for the service, so the checkout page names what is being paid for. */
function serviceBill(service: Pick<Service, 'name'>, price: number) {
  return buildBill([{ name: service.name, quantity: 1, unitAmount: price }]);
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
      id: requestId,
      pricingMode: service.pricingMode,
      price: payment.total,
      paymentId: payment.id,
      email: dto.email,
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
    const { request, payment } = await this.requireRequest(id);
    if (quoteRequired(payment, status)) {
      throw new ServiceRequestError('Send a quote before starting work.');
    }
    // A canceled bill cannot be paid again, so the request stays canceled.
    if (status !== request.status && payment.status === PAYMENT_STATUS.CANCELED) {
      throw new ServiceRequestError('This request was canceled and cannot be reopened.');
    }
    if (status === SERVICE_REQUEST_STATUS.CANCELED && request.status !== status) {
      if (!isCancelable(payment)) {
        throw new ServiceRequestError('Only unpaid requests can be canceled.');
      }
      await this.paymentGateway.cancel(payment);
    }
    return await this.serviceRepository.updateRequest(id, { status });
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
