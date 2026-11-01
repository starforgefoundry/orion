import { ACCESS_BASIS, VISIT_OUTCOME, VISIT_SOURCE } from '$lib/member_enums';
import { schema } from '$lib/server/db/schema';
import { describeWithDatabase, useTestDatabase } from '$test/db';
import { eq } from 'drizzle-orm';
import { beforeEach, expect, it } from 'vitest';
import { VisitRepository } from './visit.repository';

const TODAY = '2026-10-16';

describeWithDatabase('VisitRepository.recordAdmission', () => {
  const database = useTestDatabase('visit');
  let repository: VisitRepository;

  beforeEach(() => {
    repository = new VisitRepository(database.db);
  });

  it('logs an admitted visit', async () => {
    const member = await database.insert.member();

    const visit = await repository.recordAdmission(
      { memberId: member.id, source: VISIT_SOURCE.STAFF, accessBasis: ACCESS_BASIS.SUBSCRIPTION },
      undefined,
      TODAY,
    );

    expect(visit).toMatchObject({
      memberId: member.id,
      accessBasis: ACCESS_BASIS.SUBSCRIPTION,
      outcome: VISIT_OUTCOME.ADMITTED,
    });
  });

  it('uses up the day pass the member got in on', async () => {
    const member = await database.insert.member();
    const dayPass = await database.insert.dayPass({ memberId: member.id });

    await repository.recordAdmission(
      { memberId: member.id, source: VISIT_SOURCE.KIOSK, accessBasis: ACCESS_BASIS.DAY_PASS },
      dayPass,
      TODAY,
    );

    const [used] = await database.db
      .select()
      .from(schema.dayPass)
      .where(eq(schema.dayPass.id, dayPass.id));
    expect(used.usedDate).toBe(TODAY);
  });
});
