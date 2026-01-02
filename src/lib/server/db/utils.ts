import type { settingsTable } from '$lib/server/db/schema';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';

type KVRow = InferSelectModel<typeof settingsTable>;
type KVInsert = InferInsertModel<typeof settingsTable>;

export async function setKV<K extends keyof KVSchema>(db: Database, key: K, value: KVSchema[K]) {
  await db.insert(settingsTable).values({ key, value }).onConflictDoUpdate({
    target: settingsTable.key,
    set: { value },
  });
}

export async function getKV<K extends keyof KVSchema>(key: K): Promise<KVSchema[K] | null> {
  const row = await db.select().from(kvTable).where(kvTable.key.eq(key)).get();
  return row ? (row.value as KVSchema[K]) : null;
}
