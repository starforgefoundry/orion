import { MEMBER_STATUS, type MemberStatus } from '$lib/remotes/dtos/member.dto';
import type { Database } from '$lib/server/db';
import { schema } from '$lib/server/db/schema';
import { hasMembership, resolveAccess, spaceDate } from '$lib/server/utils/member_access';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { DateTime } from 'luxon';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MemberRepository } from './member.repository';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../db/migrations');
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
// migrations.spec.ts resets TEST_DATABASE_URL itself, so this suite uses its own database.
const DATABASE_NAME = 'orion_member_access_test';
const PAGE_SIZE = 100;

describe.skipIf(!TEST_DATABASE_URL)('MemberRepository access filter', () => {
  const now = DateTime.now();
  const today = spaceDate(now);
  const yesterday = spaceDate(now.minus({ days: 1 }));

  const admin = postgres(TEST_DATABASE_URL ?? '', { max: 1, onnotice: () => {} });
  const url = new URL(TEST_DATABASE_URL ?? 'postgres://localhost');
  url.pathname = `/${DATABASE_NAME}`;
  let sql: postgres.Sql;
  let db: Database;
  let repository: MemberRepository;

  async function addMember(name: string) {
    const [member] = await db
      .insert(schema.member)
      .values({ name, email: `${name}@example.com` })
      .returning();
    return member;
  }

  async function addSubscription(memberId: string, status: 'active' | 'canceled', ended = false) {
    await db.insert(schema.memberSubscription).values({
      id: crypto.randomUUID(),
      memberId,
      planVariationId: 'plan',
      planName: 'Monthly',
      status,
      startDate: today,
      accessEndedDate: ended ? now : null,
    });
  }

  async function addOrganization(
    memberId: string,
    options: {
      archived?: boolean;
      grantsAccess?: boolean;
      accessEndDate?: DateTime;
      removed?: boolean;
    } = {},
  ) {
    const [organization] = await db
      .insert(schema.organization)
      .values({
        name: 'Club',
        email: 'club@example.com',
        archived: options.archived ?? false,
        grantsAccess: options.grantsAccess ?? true,
        accessEndDate: options.accessEndDate ?? null,
      })
      .returning();
    await db.insert(schema.organizationMember).values({
      organizationId: organization.id,
      memberId,
      removedDate: options.removed ? now : null,
    });
  }

  async function addDayPass(memberId: string, usedDate: string | null) {
    await db
      .insert(schema.dayPass)
      .values({ memberId, squareOrderId: 'order', purchasedDate: now, usedDate });
  }

  const scenarios: Record<string, (memberId: string) => Promise<void>> = {
    nothing: async () => {},
    activeSubscription: (id) => addSubscription(id, 'active'),
    refundedSubscription: (id) => addSubscription(id, 'active', true),
    canceledSubscription: (id) => addSubscription(id, 'canceled'),
    organization: (id) => addOrganization(id),
    removedFromOrganization: (id) => addOrganization(id, { removed: true }),
    archivedOrganization: (id) => addOrganization(id, { archived: true }),
    organizationAccessOff: (id) => addOrganization(id, { grantsAccess: false }),
    expiredOrganization: (id) => addOrganization(id, { accessEndDate: now.minus({ hours: 1 }) }),
    futureOrganization: (id) => addOrganization(id, { accessEndDate: now.plus({ days: 1 }) }),
    unusedDayPass: (id) => addDayPass(id, null),
    dayPassUsedToday: (id) => addDayPass(id, today),
    dayPassUsedYesterday: (id) => addDayPass(id, yesterday),
  };

  beforeAll(async () => {
    await admin.unsafe(`DROP DATABASE IF EXISTS ${DATABASE_NAME} WITH (FORCE)`);
    await admin.unsafe(`CREATE DATABASE ${DATABASE_NAME}`);
    sql = postgres(url.toString(), { max: 1, onnotice: () => {} });
    db = drizzle(sql);
    await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
    repository = new MemberRepository(db);

    for (const [name, setup] of Object.entries(scenarios)) {
      const member = await addMember(name);
      await setup(member.id);
    }
  });

  afterAll(async () => {
    await sql?.end();
    await admin.unsafe(`DROP DATABASE IF EXISTS ${DATABASE_NAME} WITH (FORCE)`);
    await admin.end();
  });

  async function namesWithStatus(status: MemberStatus) {
    const { data } = await repository.search(
      { query: '', status, page: 1, pageSize: PAGE_SIZE },
      now,
    );
    return data.map((member) => member.name).toSorted();
  }

  it('matches hasMembership for every scenario', async () => {
    const { data: members } = await repository.search(
      { query: '', status: MEMBER_STATUS.ALL, page: 1, pageSize: PAGE_SIZE },
      now,
    );
    const contexts = await repository.getAccessContexts(members.map((member) => member.id));
    const expectedActive = members
      .filter((member) => hasMembership(contexts.get(member.id)!, now))
      .map((member) => member.name)
      .toSorted();
    const expectedInactive = members
      .map((member) => member.name)
      .filter((name) => !expectedActive.includes(name))
      .toSorted();

    expect(members).toHaveLength(Object.keys(scenarios).length);
    expect(await namesWithStatus(MEMBER_STATUS.ACTIVE)).toEqual(expectedActive);
    expect(await namesWithStatus(MEMBER_STATUS.INACTIVE)).toEqual(expectedInactive);
  });

  it('loads the same context in batch as one at a time', async () => {
    const { data: members } = await repository.search(
      { query: '', status: MEMBER_STATUS.ALL, page: 1, pageSize: PAGE_SIZE },
      now,
    );
    const contexts = await repository.getAccessContexts(members.map((member) => member.id));

    for (const member of members) {
      const single = await repository.getAccessContext(member.id);
      const batched = contexts.get(member.id)!;
      expect(batched.hasWaiver).toBe(single!.hasWaiver);
      expect(resolveAccess(batched, now)).toEqual(resolveAccess(single!, now));
    }
  });
});
