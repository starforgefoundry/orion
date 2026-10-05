import type { PrintRequestFileDto } from '$lib/remotes/dtos/print_request.dto';
import { schema } from '$lib/server/db/schema';
import { BaseRepository } from '$lib/server/repositories/base.repository';
import { fileUrl, openFile, saveFile } from '$lib/server/utils/storage';
import { eq } from 'drizzle-orm';

export class PrintFilesRepository extends BaseRepository {
  async uploadFiles(printRequestId: string, files: Array<PrintRequestFileDto>) {
    if (files.length === 0) return;

    const fileUploads = [];
    for (const file of files) {
      const uploadID = crypto.randomUUID();
      const key = await saveFile(file.file, `print_requests/${printRequestId}/${uploadID}`);

      fileUploads.push({
        id: uploadID,
        printRequestId: printRequestId,
        fileName: file.filename,
        fileUrl: key,
        quantity: file.quantity,
      });
    }

    await this.db.insert(schema.printRequestFile).values(fileUploads);
  }

  async getForRequest(id: string) {
    const files = await this.db
      .select()
      .from(schema.printRequestFile)
      .where(eq(schema.printRequestFile.printRequestId, id));

    return files.map((file) => ({ ...file, fileUrl: fileUrl(file.fileUrl) }));
  }

  async getByPrintRequestId(printRequestId: string) {
    const files = await this.db
      .select()
      .from(schema.printRequestFile)
      .where(eq(schema.printRequestFile.printRequestId, printRequestId));

    return files.map((file) => ({ ...file, fileUrl: fileUrl(file.fileUrl) }));
  }

  async openForRequest(printRequestId: string) {
    const files = await this.db
      .select()
      .from(schema.printRequestFile)
      .where(eq(schema.printRequestFile.printRequestId, printRequestId));

    return await Promise.all(
      files.map(async (file) => ({ fileName: file.fileName, ...(await openFile(file.fileUrl)) })),
    );
  }
}
