import type { PrintRequestFileDto } from '$lib/api/dtos/print_request.dto';
import { getDB } from '$lib/server/db';
import { schema } from '$lib/server/db/schema';
import { s3Repository } from '$lib/server/repositories/s3.repository';
import { eq } from 'drizzle-orm';
import JSZip from 'jszip';
import pLimit from 'p-limit';

async function uploadFiles(printRequestId: string, files: Array<PrintRequestFileDto>) {
  const db = getDB();

  const concurrentUploads = pLimit(3);

  const fileUploads = await Promise.all(
    files.map((file) =>
      concurrentUploads(async () => {
        const uploadID = crypto.randomUUID();

        const url = await s3Repository.uploadToS3(
          file.file,
          `print_requests/${printRequestId}/${uploadID}`,
        );

        return {
          id: uploadID,
          printRequestId: printRequestId,
          fileName: file.filename,
          fileUrl: url,
          quantity: file.quantity,
        };
      }),
    ),
  );

  await db.insert(schema.printRequestFile).values(fileUploads);
}

async function getForRequest(id: string) {
  const db = getDB();

  const files = await db
    .select()
    .from(schema.printRequestFile)
    .where(eq(schema.printRequestFile.printRequestId, id));

  return files;
}

async function downloadRequestZIP(id: string) {
  const files = await getForRequest(id);

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

async function getByPrintRequestId(printRequestId: string) {
  const db = getDB();

  const files = await db
    .select()
    .from(schema.printRequestFile)
    .where(eq(schema.printRequestFile.printRequestId, printRequestId));

  return files;
}

export const printFilesRepository = {
  uploadFiles,
  downloadRequestZIP,
  getByPrintRequestId,
};
