import { getRequestEvent } from '$app/server';
import type { SubmitPrintRequestDto } from '$lib/api/dtos/print_request.dto';
import { getPrintRequests } from '$lib/api/endpoints/print_request.remote';
import { BaseService } from '$lib/server/services/base.service';

class PrintRequestService extends BaseService {
  async submitPrintRequest(dto: SubmitPrintRequestDto) {
    // TODO: check if customer is a member
    const ctx = getRequestEvent().platform?.ctx;

    const customer = await this.printCustomerRepository.create(dto.customer);
    const printRequest = await this.printRequestRepository.submit(customer, dto);

    ctx?.waitUntil(this.printFilesRepository.uploadFiles(printRequest.id, dto.files));

    return {
      status: 'success',
      printRequestId: printRequest.id,
    };
  }

  async getPrintRequests() {
    return await this.printRequestRepository.getAll();
  }

  async updatePrintRequest(id: string, updates: Partial<SubmitPrintRequestDto>) {
    const updated = await this.printRequestRepository.update(id, updates);
    await getPrintRequests().refresh();

    return updated;
  }

  async getFilesByRequestId(printRequestId: string) {
    return await this.printFilesRepository.getByPrintRequestId(printRequestId);
  }
}

export const printRequestService = new PrintRequestService();
