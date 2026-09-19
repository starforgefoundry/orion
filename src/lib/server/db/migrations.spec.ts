import { schema } from '$lib/server/db/schema';
import { getTableConfig, type SQLiteTable } from 'drizzle-orm/sqlite-core';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'migrations');
const STATEMENT_BREAKPOINT = '--> statement-breakpoint';

/**
 * Replays every migration in order, which is what the D1 database has had applied to it. A column
 * that only exists in schema.ts never reaches the database, and the query that selects it fails at
 * runtime rather than at build time.
 */
function migratedDatabase() {
  const db = new DatabaseSync(':memory:');

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .toSorted();

  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');

    for (const statement of sql.split(STATEMENT_BREAKPOINT)) {
      if (statement.trim()) db.exec(statement);
    }
  }

  return { db, files };
}

function migratedColumns(db: DatabaseSync, table: string) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];

  return rows.map((row) => row.name).toSorted();
}

function declaredColumns(table: SQLiteTable) {
  return getTableConfig(table)
    .columns.map((column) => column.name)
    .toSorted();
}

describe('migrations', () => {
  const { db, files } = migratedDatabase();

  it('has migration files to apply', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(Object.entries(schema))('%s matches the columns the migrations create', (_, table) => {
    const { name } = getTableConfig(table);

    expect(migratedColumns(db, name)).toEqual(declaredColumns(table));
  });

  it('creates every table the schema declares', () => {
    const rows = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all() as {
      name: string;
    }[];
    const created = new Set(rows.map((row) => row.name));

    const missing = Object.values(schema)
      .map((table) => getTableConfig(table).name)
      .filter((name) => !created.has(name));

    expect(missing).toEqual([]);
  });
});
