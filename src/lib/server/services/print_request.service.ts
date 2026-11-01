import type {
  SearchPrintRequestsDto,
  SubmitPrintRequestDto,
  UpdatePartQuantityDto,
  UpdatePrintRequestDto,
  UpdatePrintRequestStatusDto,
} from '$lib/remotes/dtos/print_request.dto';
import type { Payment, PrintRequest } from '$lib/server/db/schema';
import { NotFoundError, UserError } from '$lib/errors';
import { DISCORD_COLOR } from '$lib/server/repositories/discord.repository';
import { BaseService } from '$lib/server/services/base.service';
import { runInBackground } from '$lib/server/utils/background';
import { SENDERS } from '$lib/server/utils/email_templates/senders';
import { printQueueUrl, printRequestStatusUrl } from '$lib/server/utils/payment_links';
import { PAYMENT_STATUS } from '$lib/utils/billing';
import { PRINT_REQUEST_STATUS, printSubmissionProblem } from '$lib/utils/print_request';
import { DateTime } from 'luxon';

function pickupPaymentNote(payment: Payment | null) {
  if (payment?.organizationId) {
    return 'This print is billed to your organization, so there is nothing for you to pay. You can check on it here:';
  }
  if (payment?.status === PAYMENT_STATUS.PENDING) {
    return 'Please pay before you pick it up. You can see the cost breakdown and pay here:';
  }
  return 'You can see your print request and its cost breakdown here:';
}

export class PrintSubmissionError extends UserError {}

export class PrintRequestService extends BaseService {
  async submitPrintRequest(dto: SubmitPrintRequestDto) {
    const settings = await this.settingsRepository.getSetting('printRequest');
    const problem = printSubmissionProblem(settings, dto.files);
    if (problem) throw new PrintSubmissionError(problem);

    const printRequest = await this.printRequestRepository.submit(dto);
    await this.printFilesRepository.uploadFiles(printRequest.id, dto.files);

    runInBackground(this.sendDiscordNotification(printRequest.id), 'send print request discord');
    runInBackground(this.sendSubmittedEmail(printRequest.id), 'send print request submitted email');

    return { printRequestId: printRequest.id };
  }

  async getPrintRequests() {
    return await this.printRequestRepository.getAll();
  }

  async searchPrintRequests(dto: SearchPrintRequestsDto) {
    return await this.printRequestRepository.search(dto);
  }

  async getPrintRequestById(id: string) {
    return await this.printRequestRepository.getById(id);
  }

  async updatePrintRequest(id: string, updates: UpdatePrintRequestDto) {
    const updated = await this.printRequestRepository.update(id, updates);

    return updated;
  }

  async updatePrintRequestStatus(id: string, dto: UpdatePrintRequestStatusDto) {
    const request = await this.printRequestRepository.getById(id);
    const payment = request?.paymentId
      ? await this.paymentRepository.getById(request?.paymentId)
      : undefined;

    const updates: Partial<PrintRequest> = { status: dto.status };
    const isUnmarkingPickup =
      request?.status === PRINT_REQUEST_STATUS.PICKED_UP &&
      dto.status === PRINT_REQUEST_STATUS.DONE;

    if (dto.status === PRINT_REQUEST_STATUS.DONE && !isUnmarkingPickup) {
      updates.completionDate = DateTime.now();

      if (payment?.organizationId) {
        await this.paymentRepository.markPaid(payment.id);
      }

      runInBackground(this.sendPickupNotification(id), 'send pickup notification');
    }

    if (dto.status === PRINT_REQUEST_STATUS.CANCELED) {
      updates.completionDate = DateTime.now();

      if (payment) {
        await this.paymentGateway.cancel(payment);
      }
    }

    const updated = await this.printRequestRepository.update(id, updates);

    return updated;
  }

  async updatePartQuantity(dto: UpdatePartQuantityDto) {
    return await this.printRequestRepository.updatePartQuantity(dto.partId, dto.quantity);
  }

  async sendPickupNotification(printRequestId: string) {
    const request = await this.printRequestRepository.getById(printRequestId);
    if (!request) {
      throw new NotFoundError('Print request not found');
    }

    await this.mailgunGateway.sendTemplate(request.email, SENDERS.print, 'print_pickup', {
      projectName: request.projectName,
      paymentNote: pickupPaymentNote(request.payment),
      statusURL: printRequestStatusUrl(request.id),
    });
  }

  private async sendSubmittedEmail(printRequestId: string) {
    const request = await this.printRequestRepository.getById(printRequestId);
    if (!request) {
      throw new Error('Print request not found');
    }

    await this.mailgunGateway.sendTemplate(request.email, SENDERS.print, 'print_submitted', {
      customerName: request.customerName,
      projectName: request.projectName,
      statusURL: printRequestStatusUrl(request.id),
    });
  }

  async getStatus(id: string) {
    const request = await this.printRequestRepository.getById(id);
    if (!request) return null;

    const payment = request.payment;
    return {
      id: request.id,
      projectName: request.projectName,
      customerName: request.customerName,
      status: request.status,
      isQuote: request.isQuote,
      submissionDate: request.submissionDate.toISO()!,
      completionDate: request.completionDate?.toISO() ?? null,
      materialName: request.material.name,
      files: request.files.map((file) => ({ fileName: file.fileName, quantity: file.quantity })),
      payment: payment && {
        status: payment.status,
        lineItems: payment.lineItems,
        discounts: payment.discounts,
        total: payment.total,
        paymentDate: payment.paymentDate?.toISO() ?? null,
        billedToOrganization: payment.organizationId !== null,
        invoiceUrl: payment.squareInvoiceId ? payment.paymentUrl : null,
      },
    };
  }

  private async sendDiscordNotification(printRequestId: string) {
    const request = await this.printRequestRepository.getById(printRequestId);
    if (!request) {
      throw new Error('Print request not found');
    }

    const embed = {
      title: '🖨️ New Print Request Submitted',
      color: DISCORD_COLOR.BLURPLE,
      fields: [
        {
          name: 'Project Name',
          value: request.projectName,
          inline: true,
        },
        {
          name: 'Customer',
          value: request.customerName,
          inline: true,
        },
        {
          name: 'Email',
          value: request.email,
          inline: false,
        },
      ],
      timestamp: new Date().toISOString(),
    };

    if (request.specialRequests) {
      embed.fields.push({
        name: 'Special Requests',
        value: request.specialRequests,
        inline: false,
      });
    }

    const { discordWebhookUrl } = await this.settingsRepository.getSetting('printRequest');
    await this.discordRepository.notify(discordWebhookUrl, {
      content: `A new print request has been submitted! [View in Print Queue](${printQueueUrl(printRequestId)})`,
      embeds: [embed],
    });
  }
}

export const printRequestService = new PrintRequestService();
