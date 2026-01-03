import { getRequestEvent } from '$app/server';
import type {
  SubmitPrintRequestDto,
  UpdatePrintRequestDto,
  UpdatePrintRequestStatusDto,
} from '$lib/remotes/dtos/print_request.dto';
import { getPrintRequests } from '$lib/remotes/endpoints/print_request.remote';
import type { PrintRequest } from '$lib/server/db/schema';
import { BaseService } from '$lib/server/services/base.service';
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
    await getPrintRequests().refresh();

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
      if (payment?.squareInvoiceId) {
        this.squareRepository.cancelInvoice(payment.squareInvoiceId);
      }
    }

    const updated = await this.printRequestRepository.update(id, updates);
    await getPrintRequests().refresh();

    return updated;
  }

  async getFilesByRequestId(printRequestId: string) {
    return await this.printFilesRepository.getByPrintRequestId(printRequestId);
  }
}

export const printRequestService = new PrintRequestService();
