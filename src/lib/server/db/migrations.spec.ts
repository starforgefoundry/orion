import { schema } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { getTableConfig, type PgTable } from 'drizzle-orm/pg-core';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { DateTime } from 'luxon';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

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
    await db.insert(schema.waiver).values({
      id: 'waiver-tz',
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
});
