import { VISIT_OUTCOME } from '$lib/utils/member-enums';
import { schema, type DayPass, type Visit } from '$lib/server/db/schema';
import { paginate, type PageRequest } from '$lib/server/db/pagination';
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

  async listByMember(memberId: string, request: PageRequest) {
    const where = eq(schema.visit.memberId, memberId);
    return await paginate(
      this.db
        .select()
        .from(schema.visit)
        .where(where)
        .orderBy(desc(schema.visit.scannedDate))
        .$dynamic(),
      this.db.select({ total: count() }).from(schema.visit).where(where),
      request,
    );
  }

  async listRecent(request: PageRequest) {
    return await paginate(
      this.db
        .select({ visit: schema.visit, member: schema.member })
        .from(schema.visit)
        .innerJoin(schema.member, eq(schema.member.id, schema.visit.memberId))
        .orderBy(desc(schema.visit.scannedDate))
        .$dynamic(),
      this.db.select({ total: count() }).from(schema.visit),
      request,
    );
  }
}
