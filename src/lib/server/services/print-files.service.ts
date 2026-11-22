import { NotFoundError } from '$lib/errors';
import { BaseService } from '$lib/server/services/base.service';
import { signUrl } from '$lib/server/utils/signed-url';
import JSZip from 'jszip';
import { Readable } from 'node:stream';

const DOWNLOAD_ROUTE = '/api/prints/download';

export class PrintFilesService extends BaseService {
  getDownloadUrl(printRequestId: string) {
    return signUrl(`${DOWNLOAD_ROUTE}/${encodeURIComponent(printRequestId)}`);
  }

  async downloadRequestZIP(printRequestId: string) {
    const request = await this.printRequestRepository.getById(printRequestId);
    if (!request) {
      throw new NotFoundError('Print request not found');
    }

    const files = await this.printFilesRepository.openForRequest(printRequestId);

    const zip = new JSZip();
    for (const file of files) {
      zip.file(`${request.customerName} - ${file.fileName}`, file.stream);
    }

    return new Readable().wrap(zip.generateNodeStream({ streamFiles: true }));
  }
}

export const printFilesService = new PrintFilesService();
