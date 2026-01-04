import { getRequestEvent } from '$app/server';
import type {
  RespondToQuoteDto,
  SubmitPrintRequestDto,
  UpdatePrintRequestDto,
  UpdatePrintRequestStatusDto,
} from '$lib/remotes/dtos/print_request.dto';
import type { PrintRequest } from '$lib/server/db/schema';
import { BaseService } from '$lib/server/services/base.service';
import { printPaymentService } from '$lib/server/services/print_payment.service';
import { DateTime } from 'luxon';

export class PrintRequestService extends BaseService {
  async submitPrintRequest(dto: SubmitPrintRequestDto) {
    // TODO: check if customer is a member
    const printRequest = await this.printRequestRepository.submit(dto);

    const ctx = getRequestEvent().platform?.ctx;
    ctx?.waitUntil(this.printFilesRepository.uploadFiles(printRequest.id, dto.files));

    return {
      status: 'success',
      printRequestId: printRequest.id,
    };
  }

  async getPrintRequests() {
    return await this.printRequestRepository.getAll();
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
      ? await this.printPaymentRepository.getById(request?.paymentId)
      : undefined;

    const updates: Partial<PrintRequest> = { status: dto.status };

    if (dto.status === 'done') {
      updates.completionDate = DateTime.now();
      // TODO: send notification email to customer
    }

    if (dto.status === 'canceled') {
      updates.completionDate = DateTime.now();

      // cancel any outstanding invoices
      if (payment?.squareInvoiceId && payment.status !== 'canceled') {
        this.squareRepository.cancelInvoice(payment.squareInvoiceId);
      }

      // cancel payment
      if (payment) {
        await this.printPaymentRepository.updatePayment(payment.id, { status: 'canceled' });
      }
    }

    const updated = await this.printRequestRepository.update(id, updates);

    return updated;
  }

  async getFilesByRequestId(printRequestId: string) {
    return await this.printFilesRepository.getByPrintRequestId(printRequestId);
  }

  async getPrintRequestQuote(id: string) {
    const request = await this.printRequestRepository.getById(id);
    if (request?.payment?.status !== 'quote') {
      throw new Error('Print request is not in quote status');
    }

    return request;
  }

  async respondToQuote(dto: RespondToQuoteDto) {
    const request = await this.printRequestRepository.getById(dto.id);
    if (!request) {
      throw new Error('Print request not found');
    }

    if (request.payment?.status !== 'quote' || !request.isQuote) {
      throw new Error('Print request is not a quote');
    }

    if (!dto.approve) {
      // User declined the quote, cancel the request
      await this.updatePrintRequestStatus(dto.id, { status: 'canceled' });
      return { status: 'canceled' };
    }

    // User accepted the quote, proceed to create an order
    return await printPaymentService.upsertOrder(request, {
      requestId: request.id,
      materialCost: request.materialCost!,
      buildPlates: request.buildplateCount!,
    });
  }
}

export const printRequestService = new PrintRequestService();
