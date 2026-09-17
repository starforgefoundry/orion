import { schema } from '$lib/server/db/schema';
import { BaseRepository } from '$lib/server/repositories/base.repository';
import { s3PublicUrl, uploadToS3 } from '$lib/server/utils/s3';
import { desc, eq, inArray } from 'drizzle-orm';
import pLimit from 'p-limit';

function extensionOf(fileName: string) {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(dot).toLowerCase() : '';
}

type NewComment = {
  printRequestId: string;
  authorEmail: string;
  body: string;
  attachments: File[];
};

export class PrintRequestCommentRepository extends BaseRepository {
  async create(comment: NewComment) {
    const id = crypto.randomUUID();
    const concurrentUploads = pLimit(3);

    const attachments = await Promise.all(
      comment.attachments.map((attachment) =>
        concurrentUploads(async () => {
          const fileId = crypto.randomUUID();

          const fileUrl = await uploadToS3(
            this.s3,
            attachment,
            `print_requests/${comment.printRequestId}/comments/${fileId}${extensionOf(attachment.name)}`,
          );

          return {
            id: fileId,
            commentId: id,
            fileName: attachment.name,
            fileUrl,
          };
        }),
      ),
    );

    const created = await this.db
      .insert(schema.printRequestComment)
      .values({
        id,
        printRequestId: comment.printRequestId,
        authorEmail: comment.authorEmail,
        body: comment.body,
      })
      .returning()
      .get();

    if (attachments.length > 0) {
      await this.db.insert(schema.printRequestCommentFile).values(attachments);
    }

    return created;
  }

  async getForRequest(printRequestId: string) {
    const rows = await this.db
      .select()
      .from(schema.printRequestComment)
      .leftJoin(schema.user, eq(schema.printRequestComment.authorEmail, schema.user.email))
      .where(eq(schema.printRequestComment.printRequestId, printRequestId))
      .orderBy(desc(schema.printRequestComment.createdDate));

    const attachments = await this.getAttachments(rows.map((row) => row.print_request_comment.id));

    return rows.map(({ print_request_comment: comment, user: author }) => ({
      ...comment,
      authorName: author?.name ?? comment.authorEmail,
      attachments: attachments.filter((attachment) => attachment.commentId === comment.id),
    }));
  }

  private async getAttachments(commentIds: string[]) {
    if (commentIds.length === 0) {
      return [];
    }

    const attachments = await this.db
      .select()
      .from(schema.printRequestCommentFile)
      .where(inArray(schema.printRequestCommentFile.commentId, commentIds));

    return attachments.map((attachment) => ({
      ...attachment,
      fileUrl: s3PublicUrl(attachment.fileUrl),
    }));
  }
}
