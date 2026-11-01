import { schema } from '$lib/server/db/schema';
import { SPACE_ZONE } from '$lib/space';
import { EMAIL_TEMPLATE_KEYS } from '$lib/utils/email_templates';
import { describeWithDatabase, useTestDatabase } from '$test/db';
import { eq } from 'drizzle-orm';
import { getTableConfig, type PgTable } from 'drizzle-orm/pg-core';
import { DateTime } from 'luxon';
import { expect, it } from 'vitest';

/**
 * A column that only exists in schema.ts never reaches the database, and the query that selects
 * it fails at runtime rather than at build time.
 */
describeWithDatabase('migrations', () => {
  const database = useTestDatabase('migrations');

  async function migratedColumns(table: string) {
    const rows = await database.sql<{ column_name: string }[]>`
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
    const rows = await database.sql<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
    `;
    const created = new Set(rows.map((row) => row.table_name));

    const missing = Object.values(schema)
      .map((table) => getTableConfig(table).name)
      .filter((name) => !created.has(name));

    expect(missing).toEqual([]);
  });

  it('seeds every email template the app can send', async () => {
    const rows = await database.sql<{ key: string }[]>`SELECT key FROM email_template`;
    const seeded = new Set(rows.map((row) => row.key));

    expect(EMAIL_TEMPLATE_KEYS.filter((key) => !seeded.has(key))).toEqual([]);
  });

  it('round-trips timestamps without shifting them', async () => {
    const { db } = database;
    const signedDate = DateTime.fromISO('2026-03-08T01:30:00.123', { zone: SPACE_ZONE });
    const member = await database.insert.member();
    const { id } = await database.insert.waiver({ memberId: member.id, signedDate });

    const [stored] = await db.select().from(schema.waiver).where(eq(schema.waiver.id, id));
    await db.update(schema.waiver).set({ signedDate: stored.signedDate });
    const [resaved] = await db.select().from(schema.waiver).where(eq(schema.waiver.id, id));

    expect(stored.signedDate.toMillis()).toBe(signedDate.toMillis());
    expect(resaved.signedDate.toMillis()).toBe(signedDate.toMillis());
    expect(resaved.signedDate.zoneName).toBe(SPACE_ZONE);
  });
});
