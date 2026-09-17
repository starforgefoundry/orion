import type { AddPrintRequestCommentDto } from '$lib/remotes/dtos/print_request.dto';
import { BaseService } from '$lib/server/services/base.service';

export class PrintRequestCommentService extends BaseService {
  async getForRequest(printRequestId: string) {
    return await this.printRequestCommentRepository.getForRequest(printRequestId);
  }

  async addComment(dto: AddPrintRequestCommentDto, authorEmail: string) {
    return await this.printRequestCommentRepository.create({
      printRequestId: dto.printRequestId,
      authorEmail,
      body: dto.body,
      attachments: dto.attachments ?? [],
    });
  }
}

export const printRequestCommentService = new PrintRequestCommentService();
