import { BaseService } from '$lib/server/services/base.service';
import JSZip from 'jszip';
import { Readable } from 'node:stream';

export class PrintFilesService extends BaseService {
  async getByRequestId(printRequestId: string) {
    return await this.printFilesRepository.getByPrintRequestId(printRequestId);
  }

  async downloadRequestZIP(printRequestId: string) {
    const files = await this.printFilesRepository.openForRequest(printRequestId);

    const zip = new JSZip();
    for (const file of files) {
      zip.file(file.fileName, file.stream);
    }

    return new Readable().wrap(zip.generateNodeStream({ streamFiles: true }));
  }
}

export const printFilesService = new PrintFilesService();
