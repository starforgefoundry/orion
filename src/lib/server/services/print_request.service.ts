import { getRequestEvent } from '$app/server';
import type { SubmitPrintRequestDto } from '$lib/remotes/dtos/print_request.dto';
import { getPrintRequests } from '$lib/remotes/endpoints/print_request.remote';
import { BaseService } from '$lib/server/services/base.service';

class PrintRequestService extends BaseService {
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
