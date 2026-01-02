import type { PrintRequestFileDto } from '$lib/remotes/dtos/print_request.dto';
import { schema } from '$lib/server/db/schema';
import { BaseRepository } from '$lib/server/repositories/base.repository';
import { uploadToS3 } from '$lib/server/utils/s3';
import { eq } from 'drizzle-orm';
import pLimit from 'p-limit';

export class PrintFilesRepository extends BaseRepository {
  async uploadFiles(printRequestId: string, files: Array<PrintRequestFileDto>) {
    const concurrentUploads = pLimit(3);

    const fileUploads = await Promise.all(
      files.map((file) =>
        concurrentUploads(async () => {
          const uploadID = crypto.randomUUID();

          const url = await uploadToS3(
            this.s3,
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

    await this.db.insert(schema.printRequestFile).values(fileUploads);
  }

  async getForRequest(id: string) {
    const files = await this.db
      .select()
      .from(schema.printRequestFile)
      .where(eq(schema.printRequestFile.printRequestId, id));

    return files;
  }

  async getByPrintRequestId(printRequestId: string) {
    const files = await this.db
      .select()
      .from(schema.printRequestFile)
      .where(eq(schema.printRequestFile.printRequestId, printRequestId));

    return files;
  }
}
