import { VISIT_OUTCOME } from '$lib/utils/member-enums';
import { schema, type DayPass, type Visit } from '$lib/server/db/schema';
import { BaseRepository } from '$lib/server/repositories/base.repository';
import { count, desc, eq } from 'drizzle-orm';

export type CreateVisit = Pick<Visit, 'memberId' | 'source' | 'accessBasis' | 'outcome'>;

export class VisitRepository extends BaseRepository {
  async create(visit: CreateVisit) {
    const [created] = await this.db.insert(schema.visit).values(visit).returning();
    return created;
  }

  /** Logs an admitted visit, using up the day pass it was let in on. */
  async recordAdmission(
    visit: Omit<CreateVisit, 'outcome'>,
    dayPassToUse: Pick<DayPass, 'id'> | undefined,
    today: string,
  ) {
    return await this.db.transaction(async (tx) => {
      if (dayPassToUse) {
        await tx
          .update(schema.dayPass)
          .set({ usedDate: today })
          .where(eq(schema.dayPass.id, dayPassToUse.id));
      }
      const [created] = await tx
        .insert(schema.visit)
        .values({ ...visit, outcome: VISIT_OUTCOME.ADMITTED })
        .returning();
      return created;
    });
  }

  async listByMember(memberId: string, page: number, pageSize: number) {
    const where = eq(schema.visit.memberId, memberId);
    const [[{ total }], data] = await Promise.all([
      this.db.select({ total: count() }).from(schema.visit).where(where),
      this.db
        .select()
        .from(schema.visit)
        .where(where)
        .orderBy(desc(schema.visit.scannedDate))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
    ]);
    return { data, pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } };
  }

  async listRecent(page: number, pageSize: number) {
    const [[{ total }], data] = await Promise.all([
      this.db.select({ total: count() }).from(schema.visit),
      this.db
        .select({ visit: schema.visit, member: schema.member })
        .from(schema.visit)
        .innerJoin(schema.member, eq(schema.member.id, schema.visit.memberId))
        .orderBy(desc(schema.visit.scannedDate))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
    ]);
    return { data, pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } };
  }
}
