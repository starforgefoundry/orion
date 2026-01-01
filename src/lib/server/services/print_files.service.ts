import { BaseService } from '$lib/server/services/base.service';
import JSZip from 'jszip';
import pLimit from 'p-limit';

class PrintFilesService extends BaseService {
  async getByRequestId(printRequestId: string) {
    return await this.printFilesRepository.getByPrintRequestId(printRequestId);
  }

  async downloadRequestZIP(printRequestId: string) {
    const files = await this.getByRequestId(printRequestId);

    const zip = new JSZip();
    const concurrentDownloads = pLimit(5);

    await Promise.all(
      files.map((file) =>
        concurrentDownloads(async () => {
          const response = await fetch(file.fileUrl);
          const arrayBuffer = await response.arrayBuffer();
          zip.file(file.fileName, arrayBuffer);
        }),
      ),
    );

    const zipBlob = await zip.generateAsync({ type: 'blob' });

    return zipBlob;
  }
}

export const printFilesService = new PrintFilesService();
