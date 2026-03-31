import type { SubmitWaiverDto } from '$lib/remotes/dtos/waiver.dto';
import { schema } from '$lib/server/db/schema';
import { BaseRepository } from '$lib/server/repositories/base.repository';
import { uploadToS3 } from '$lib/server/utils/s3';
import { asc, count, like, or } from 'drizzle-orm';

export class WaiverRepository extends BaseRepository {
  async submit(dto: SubmitWaiverDto, signatureFile: File) {
    const waiverId = crypto.randomUUID();
    const sanitizedName = `${dto.firstName}_${dto.lastName}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `waivers/${sanitizedName}_${dateStr}_${waiverId}`;

    const signatureUrl = await uploadToS3(this.s3, signatureFile, filename);

    return await this.db
      .insert(schema.waiver)
      .values({
        id: waiverId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        signatureUrl,
      })
      .returning()
      .get();
  }

  async getAll(dto: { query: string; page: number; pageSize: number }) {
    const whereClause =
      dto.query.trim() !== ''
        ? or(
            like(schema.waiver.firstName, `%${dto.query}%`),
            like(schema.waiver.lastName, `%${dto.query}%`),
            like(schema.waiver.email, `%${dto.query}%`),
          )
        : undefined;

    const totalResult = await this.db
      .select({ count: count() })
      .from(schema.waiver)
      .where(whereClause)
      .execute();

    const total = totalResult[0]?.count ?? 0;

    const results = await this.db
      .select()
      .from(schema.waiver)
      .where(whereClause)
      .orderBy(asc(schema.waiver.lastName), asc(schema.waiver.firstName))
      .limit(dto.pageSize)
      .offset((dto.page - 1) * dto.pageSize)
      .execute();

    const totalPages = Math.ceil(total / dto.pageSize);

    return {
      data: results,
      pagination: {
        total,
        page: dto.page,
        pageSize: dto.pageSize,
        totalPages,
      },
    };
  }

  async getById(id: string) {
    const results = await this.db
      .select()
      .from(schema.waiver)
      .where(like(schema.waiver.id, id))
      .limit(1)
      .execute();

    return results[0] ?? null;
  }
}
