import { BaseService } from '$lib/server/services/base.service';
import { signUrl } from '$lib/server/utils/signed_url';
import JSZip from 'jszip';
import { Readable } from 'node:stream';

const DOWNLOAD_ROUTE = '/api/prints/download';

export class PrintFilesService extends BaseService {
  async getByRequestId(printRequestId: string) {
    return await this.printFilesRepository.getByPrintRequestId(printRequestId);
  }

  getDownloadUrl(printRequestId: string) {
    return signUrl(`${DOWNLOAD_ROUTE}/${encodeURIComponent(printRequestId)}`);
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
