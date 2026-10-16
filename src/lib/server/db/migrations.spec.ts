import { schema } from '$lib/server/db/schema';
import { CarBayRepository } from '$lib/server/repositories/car_bay.repository';
import { CarBayRules, CarBaySlotTakenError, DEFAULT_CAR_BAY_POLICY } from '$lib/utils/car_bay';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { getTableConfig, type PgTable } from 'drizzle-orm/pg-core';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { DateTime } from 'luxon';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'migrations');
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

/**
 * A column that only exists in schema.ts never reaches the database, and the query that selects
 * it fails at runtime rather than at build time.
 */
describe.skipIf(!TEST_DATABASE_URL)('migrations', () => {
  const sql = postgres(TEST_DATABASE_URL ?? '', { max: 1, onnotice: () => {} });

  beforeAll(async () => {
    await sql`DROP SCHEMA IF EXISTS public CASCADE`;
    await sql`DROP SCHEMA IF EXISTS drizzle CASCADE`;
    await sql`CREATE SCHEMA public`;
    await migrate(drizzle(sql), { migrationsFolder: MIGRATIONS_DIR });
  });

  afterAll(async () => {
    await sql.end();
  });

  async function migratedColumns(table: string) {
    const rows = await sql<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${table}
    `;
    return rows.map((row) => row.column_name).toSorted();
  }

  function declaredColumns(table: PgTable) {
    return getTableConfig(table)
      .columns.map((column) => column.name)
      .toSorted();
  }

  it.each(Object.entries(schema))(
    '%s matches the columns the migrations create',
    async (_, table) => {
      const { name } = getTableConfig(table);

      expect(await migratedColumns(name)).toEqual(declaredColumns(table));
    },
  );

  it('creates every table the schema declares', async () => {
    const rows = await sql<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
    `;
    const created = new Set(rows.map((row) => row.table_name));

    const missing = Object.values(schema)
      .map((table) => getTableConfig(table).name)
      .filter((name) => !created.has(name));

    expect(missing).toEqual([]);
  });

  it('round-trips timestamps without shifting them', async () => {
    const db = drizzle(sql);
    const signedDate = DateTime.fromISO('2026-03-08T01:30:00.123', { zone: 'America/Chicago' });
    await db
      .insert(schema.member)
      .values({ id: 'member-tz', name: 'Jane', email: 'jane@example.com' });
    await db.insert(schema.waiver).values({
      id: 'waiver-tz',
      memberId: 'member-tz',
      name: 'Jane',
      email: 'jane@example.com',
      signatureUrl: 'waivers/jane',
      signedDate,
    });

    const [stored] = await db.select().from(schema.waiver).where(eq(schema.waiver.id, 'waiver-tz'));
    await db.update(schema.waiver).set({ signedDate: stored.signedDate });
    const [resaved] = await db
      .select()
      .from(schema.waiver)
      .where(eq(schema.waiver.id, 'waiver-tz'));

    expect(stored.signedDate.toMillis()).toBe(signedDate.toMillis());
    expect(resaved.signedDate.toMillis()).toBe(signedDate.toMillis());
    expect(resaved.signedDate.zoneName).toBe('America/Chicago');
  });

  describe('car bay overlap constraint', () => {
    const repository = new CarBayRepository(drizzle(sql));

    function booking(start: string, end: string) {
      const endAt = DateTime.fromISO(end, { zone: 'America/Chicago' });
      return {
        tier: 'hourly' as const,
        status: 'confirmed' as const,
        startAt: DateTime.fromISO(start, { zone: 'America/Chicago' }),
        endAt,
        blockedUntil: new CarBayRules(DEFAULT_CAR_BAY_POLICY).blockedUntil(endAt),
        isMember: true,
        customerName: 'Jane Doe',
        customerEmail: 'jane@example.com',
        customerPhone: '555-0100',
      };
    }

    beforeEach(async () => {
      await sql`TRUNCATE car_bay_booking CASCADE`;
    });

    it('rejects a booking that overlaps a confirmed one', async () => {
      await repository.create(booking('2026-10-17T12:00', '2026-10-17T14:00'));

      await expect(
        repository.create(booking('2026-10-17T13:00', '2026-10-17T15:00')),
      ).rejects.toThrow(CarBaySlotTakenError);
    });

    it('rejects a booking that starts inside the 30 minute buffer', async () => {
      await repository.create(booking('2026-10-17T12:00', '2026-10-17T14:00'));

      await expect(
        repository.create(booking('2026-10-17T14:15', '2026-10-17T16:15')),
      ).rejects.toThrow(CarBaySlotTakenError);
      await expect(
        repository.create(booking('2026-10-17T14:30', '2026-10-17T16:30')),
      ).resolves.toBeDefined();
    });

    it('frees the time once a booking is canceled or a no-show', async () => {
      const canceled = await repository.create(booking('2026-10-17T12:00', '2026-10-17T14:00'));
      await repository.update(canceled.id, { status: 'canceled' });
      const noShow = await repository.create(booking('2026-10-17T12:00', '2026-10-17T14:00'));
      await repository.update(noShow.id, { status: 'no_show' });

      await expect(
        repository.create(booking('2026-10-17T12:00', '2026-10-17T14:00')),
      ).resolves.toBeDefined();
    });

    it('lets only one of two simultaneous checkouts win', async () => {
      const results = await Promise.allSettled([
        repository.create(booking('2026-10-17T12:00', '2026-10-17T14:00')),
        repository.create(booking('2026-10-17T13:00', '2026-10-17T15:00')),
      ]);

      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    });
  });
});

describe.skipIf(!TEST_DATABASE_URL)('member management migration', () => {
  const sql = postgres(TEST_DATABASE_URL ?? '', { max: 1, onnotice: () => {} });

  async function runMigrationFile(tag: string) {
    const contents = await readFile(join(MIGRATIONS_DIR, `${tag}.sql`), 'utf8');
    for (const statement of contents.split('--> statement-breakpoint')) {
      await sql.unsafe(statement);
    }
  }

  beforeAll(async () => {
    await sql`DROP SCHEMA IF EXISTS public CASCADE`;
    await sql`DROP SCHEMA IF EXISTS drizzle CASCADE`;
    await sql`CREATE SCHEMA public`;
    await runMigrationFile('0000_baseline');
    await runMigrationFile('0001_car_bay_booking');
    await sql`
      INSERT INTO waiver (id, name, email, signature_url, signed_date) VALUES
        ('w1', 'Old Name', 'Sam@Example.com ', 'waivers/w1', '2025-01-01T00:00:00Z'),
        ('w2', 'New Name', 'sam@example.com', 'waivers/w2', '2026-01-01T00:00:00Z'),
        ('w3', 'Alex', 'alex@example.com', 'waivers/w3', '2025-06-01T00:00:00Z')
    `;
    await runMigrationFile('0002_member_management');
  });

  afterAll(async () => {
    await sql.end();
  });

  it('creates one member per waiver email using the latest name', async () => {
    const members = await sql<{ email: string; name: string }[]>`
      SELECT email, name FROM member ORDER BY email
    `;

    expect(members).toEqual([
      { email: 'alex@example.com', name: 'Alex' },
      { email: 'sam@example.com', name: 'New Name' },
    ]);
  });

  it('links every waiver to its member', async () => {
    const rows = await sql<{ id: string; email: string }[]>`
      SELECT waiver.id, member.email FROM waiver JOIN member ON member.id = waiver.member_id
      ORDER BY waiver.id
    `;

    expect(rows).toEqual([
      { id: 'w1', email: 'sam@example.com' },
      { id: 'w2', email: 'sam@example.com' },
      { id: 'w3', email: 'alex@example.com' },
    ]);
  });
});
