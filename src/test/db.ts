import type { Database } from '$lib/server/db';
import { schema, type Member } from '$lib/server/db/schema';
import { factory, newId } from '$test/factory';
import { getTableConfig, type PgTable } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, beforeEach, describe } from 'vitest';

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
export const MIGRATIONS_DIR = fileURLToPath(
  new URL('../lib/server/db/migrations', import.meta.url),
);
const STATEMENT_BREAKPOINT = '--> statement-breakpoint';
const CONNECTION_OPTIONS = { max: 1, onnotice: () => {} };
// Rows the migrations insert that the app expects to exist.
const SEEDED_TABLES = new Set([getTableConfig(schema.emailTemplate).name]);

export const describeWithDatabase = describe.skipIf(!TEST_DATABASE_URL);

export interface TestDatabase {
  db: Database;
  sql: postgres.Sql;
}

/**
 * Inserts factory rows. Rows that reference others need those ids passed in, e.g.
 * `insert.dayPass({ memberId: member.id })`.
 */
export function rowInserter(database: TestDatabase) {
  function inserter<Row>(table: PgTable, build: (overrides?: Partial<Row>) => Row) {
    return async (overrides: Partial<Row> = {}): Promise<Row> => {
      const [row] = await database.db
        .insert(table)
        .values(build(overrides) as never)
        .returning();
      return row as Row;
    };
  }

  return {
    user: inserter(schema.user, factory.user),
    member: inserter(schema.member, (overrides?: Partial<Member>) =>
      factory.member({ email: `${newId()}@example.com`, ...overrides }),
    ),
    waiver: inserter(schema.waiver, factory.waiver),
    memberSubscription: inserter(schema.memberSubscription, factory.memberSubscription),
    dayPass: inserter(schema.dayPass, factory.dayPass),
    memberEmail: inserter(schema.memberEmail, factory.memberEmail),
    organization: inserter(schema.organization, factory.organization),
    organizationMember: inserter(schema.organizationMember, factory.organizationMember),
    payment: inserter(schema.payment, factory.payment),
    classCatalog: inserter(schema.classCatalog, factory.classCatalog),
    classInstance: inserter(schema.classInstance, factory.classInstance),
    classBooking: inserter(schema.classBooking, factory.classBooking),
    carBayBooking: inserter(schema.carBayBooking, factory.carBayBooking),
    carBayClosure: inserter(schema.carBayClosure, factory.carBayClosure),
    printMaterial: inserter(schema.printMaterial, factory.printMaterial),
    printRequest: inserter(schema.printRequest, factory.printRequest),
  };
}

function databaseUrl(name: string) {
  const url = new URL(TEST_DATABASE_URL ?? 'postgres://localhost');
  url.pathname = `/${name}`;
  return url.toString();
}

/**
 * Creates an empty database for one spec file and drops it afterwards. Each file gets its own
 * database because vitest runs files in parallel.
 */
export function useEmptyDatabase(name: string): TestDatabase {
  const databaseName = `orion_${name}_test`;
  const admin = postgres(TEST_DATABASE_URL ?? '', CONNECTION_OPTIONS);
  const handle = {} as TestDatabase;

  beforeAll(async () => {
    await admin.unsafe(`DROP DATABASE IF EXISTS ${databaseName} WITH (FORCE)`);
    await admin.unsafe(`CREATE DATABASE ${databaseName}`);
    handle.sql = postgres(databaseUrl(databaseName), CONNECTION_OPTIONS);
    handle.db = drizzle(handle.sql);
  });

  afterAll(async () => {
    await handle.sql?.end();
    await admin.unsafe(`DROP DATABASE IF EXISTS ${databaseName} WITH (FORCE)`);
    await admin.end();
  });

  return handle;
}

/** A migrated database whose tables are emptied before every test. */
export function useTestDatabase(name: string) {
  const handle = useEmptyDatabase(name);
  const tables = Object.values(schema)
    .map((table) => getTableConfig(table).name)
    .filter((table) => !SEEDED_TABLES.has(table));

  beforeAll(async () => {
    await migrate(handle.db, { migrationsFolder: MIGRATIONS_DIR });
  });

  beforeEach(async () => {
    await handle.sql.unsafe(`TRUNCATE ${tables.map((table) => `"${table}"`).join(', ')} CASCADE`);
  });

  return Object.assign(handle, { insert: rowInserter(handle) });
}

export async function runMigrationFile(sql: postgres.Sql, tag: string) {
  const contents = await readFile(`${MIGRATIONS_DIR}/${tag}.sql`, 'utf8');
  for (const statement of contents.split(STATEMENT_BREAKPOINT)) {
    await sql.unsafe(statement);
  }
}

export async function runMigrationFiles(sql: postgres.Sql, tags: string[]) {
  for (const tag of tags) {
    await runMigrationFile(sql, tag);
  }
}
