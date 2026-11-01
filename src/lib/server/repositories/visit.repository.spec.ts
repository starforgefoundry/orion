import { ACCESS_BASIS, VISIT_OUTCOME, VISIT_SOURCE } from '$lib/member_enums';
import type { Database } from '$lib/server/db';
import { schema } from '$lib/server/db/schema';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { eq } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { VisitRepository } from './visit.repository';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../db/migrations');
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
// migrations.spec.ts resets TEST_DATABASE_URL itself, so this suite uses its own database.
const DATABASE_NAME = 'orion_visit_test';
const TODAY = '2026-10-16';

describe.skipIf(!TEST_DATABASE_URL)('VisitRepository.recordAdmission', () => {
  const admin = postgres(TEST_DATABASE_URL ?? '', { max: 1, onnotice: () => {} });
  const url = new URL(TEST_DATABASE_URL ?? 'postgres://localhost');
  url.pathname = `/${DATABASE_NAME}`;
  let sql: postgres.Sql;
  let db: Database;
  let repository: VisitRepository;

  beforeAll(async () => {
    await admin.unsafe(`DROP DATABASE IF EXISTS ${DATABASE_NAME} WITH (FORCE)`);
    await admin.unsafe(`CREATE DATABASE ${DATABASE_NAME}`);
    sql = postgres(url.toString(), { max: 1, onnotice: () => {} });
    db = drizzle(sql);
    await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
    repository = new VisitRepository(db);
  });

  afterAll(async () => {
    await sql?.end();
    await admin.unsafe(`DROP DATABASE IF EXISTS ${DATABASE_NAME} WITH (FORCE)`);
    await admin.end();
  });

  async function addMember(name: string) {
    const [member] = await db
      .insert(schema.member)
      .values({ name, email: `${name}@example.com` })
      .returning();
    return member;
  }

  it('logs an admitted visit', async () => {
    const member = await addMember('subscriber');

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
    const member = await addMember('daypass');
    const [dayPass] = await db
      .insert(schema.dayPass)
      .values({ memberId: member.id, squareOrderId: 'order', purchasedDate: DateTime.now() })
      .returning();

    await repository.recordAdmission(
      { memberId: member.id, source: VISIT_SOURCE.KIOSK, accessBasis: ACCESS_BASIS.DAY_PASS },
      dayPass,
      TODAY,
    );

    const [used] = await db.select().from(schema.dayPass).where(eq(schema.dayPass.id, dayPass.id));
    expect(used.usedDate).toBe(TODAY);
  });
});
