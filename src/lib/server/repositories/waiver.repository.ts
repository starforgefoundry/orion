import { schema, type Waiver } from '$lib/server/db/schema';
import { BaseRepository } from '$lib/server/repositories/base.repository';
import { fileUrl, saveFile } from '$lib/server/utils/storage';
import { spaceDate } from '$lib/utils/space';
import { asc, count, desc, eq, ilike, or } from 'drizzle-orm';
import { DateTime } from 'luxon';

export type NewWaiver = Pick<Waiver, 'name' | 'email' | 'isAdult'> & { signature: File };

/** Named by the signer and the day they signed at the space. */
export function signatureKey(name: string, waiverId: string, signedAt: DateTime) {
  const sanitizedName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `waivers/${sanitizedName}_${spaceDate(signedAt)}_${waiverId}`;
}

export class WaiverRepository extends BaseRepository {
  async submit(dto: NewWaiver, memberId: string, source: Waiver['source']) {
    const waiverId = crypto.randomUUID();
    const signatureUrl = await saveFile(
      dto.signature,
      signatureKey(dto.name, waiverId, DateTime.now()),
    );

    const [waiver] = await this.db
      .insert(schema.waiver)
      .values({
        id: waiverId,
        memberId,
        name: dto.name,
        email: dto.email,
        signatureUrl,
        isAdult: dto.isAdult,
        source,
      })
      .returning();
    return waiver;
  }

  async getAll(dto: { query: string; page: number; pageSize: number }) {
    const whereClause =
      dto.query.trim() !== ''
        ? or(
            ilike(schema.waiver.name, `%${dto.query}%`),
            ilike(schema.waiver.email, `%${dto.query}%`),
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
      .orderBy(desc(schema.waiver.signedDate), asc(schema.waiver.name))
      .limit(dto.pageSize)
      .offset((dto.page - 1) * dto.pageSize)
      .execute();

    const totalPages = Math.ceil(total / dto.pageSize);

    return {
      data: results.map((w) => ({ ...w, signatureUrl: fileUrl(w.signatureUrl) })),
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
      .where(eq(schema.waiver.id, id))
      .limit(1)
      .execute();

    const waiver = results[0];
    return waiver ? { ...waiver, signatureUrl: fileUrl(waiver.signatureUrl) } : null;
  }
}
