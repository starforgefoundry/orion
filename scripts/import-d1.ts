/**
 * Usage: node scripts/import-d1.ts <d1-export.sql>
 *
 * The export comes from `wrangler d1 export orion-prod --remote --output=d1.sql`.
 * DATABASE_URL must point at a migrated, empty Postgres database.
 */
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import postgres from 'postgres';

const TABLES_IN_DEPENDENCY_ORDER = [
  'user',
  'organization',
  'print_material',
  'billing_code',
  'payment',
  'print_request',
  'print_request_file',
  'print_request_comment',
  'print_request_comment_file',
  'organization_charge',
  'inventory_item',
  'purchase_list',
  'waiver',
  'class_catalog',
  'class_instance',
  'class_booking',
  'settings',
  'square_webhook_log',
];

const D1_INTERNAL_TABLES = ['d1_migrations', 'sqlite_sequence', '_cf_KV', '_cf_METADATA'];
const INSERT_BATCH_SIZE = 500;

type Row = Record<string, unknown>;
type ColumnTypes = Map<string, string>;

const exportPath = process.argv[2];
if (!exportPath) throw new Error('Usage: node scripts/import-d1.ts <d1-export.sql>');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

const sqlite = new DatabaseSync(':memory:', { enableForeignKeyConstraints: false });
sqlite.exec(readFileSync(exportPath, 'utf8'));

const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });

/** D1 stored UTC timestamps as `YYYY-MM-DD HH:MM:SS.ffffff`; Postgres keeps milliseconds. */
const LEGACY_TIMESTAMP = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.(\d+))?Z?$/;

function legacyTimestampToIso(value: string) {
  const match = LEGACY_TIMESTAMP.exec(value);
  if (!match) throw new Error(`Unrecognized timestamp "${value}"`);

  const [, date, seconds, fraction = '0'] = match;
  return `${date}T${seconds}.${fraction.slice(0, 3).padEnd(3, '0')}Z`;
}

function sqliteBoolean(value: unknown) {
  if (value !== 0 && value !== 1) throw new Error(`Unrecognized boolean "${value}"`);
  return value === 1;
}

function convert(value: unknown, pgType: string) {
  if (value === null) return null;

  switch (pgType) {
    case 'boolean':
      return sqliteBoolean(value);
    case 'jsonb':
      return sql.json(JSON.parse(value as string));
    case 'timestamp with time zone':
      return legacyTimestampToIso(value as string);
    default:
      return value;
  }
}

async function columnTypes(table: string): Promise<ColumnTypes> {
  const rows = await sql<{ column_name: string; data_type: string }[]>`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${table}
  `;
  return new Map(rows.map((row) => [row.column_name, row.data_type]));
}

function convertRow(table: string, row: Row, types: ColumnTypes) {
  const converted: Row = {};
  for (const [column, value] of Object.entries(row)) {
    const pgType = types.get(column);
    if (!pgType) throw new Error(`${table}.${column} does not exist in Postgres`);

    try {
      converted[column] = convert(value, pgType);
    } catch (e) {
      throw new Error(`${table}.${column}: ${(e as Error).message}`);
    }
  }
  return converted;
}

function sqliteRows(table: string) {
  return sqlite.prepare(`SELECT * FROM "${table}"`).all() as Row[];
}

function warnAboutUnknownTables() {
  const tables = sqlite.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all() as {
    name: string;
  }[];

  const known = new Set([...TABLES_IN_DEPENDENCY_ORDER, ...D1_INTERNAL_TABLES]);
  for (const { name } of tables) {
    if (!known.has(name)) console.warn(`Skipping unknown table "${name}"`);
  }
}

async function assertTargetIsEmpty() {
  for (const table of TABLES_IN_DEPENDENCY_ORDER) {
    const [{ count }] = await sql<{ count: number }[]>`SELECT count(*)::int FROM ${sql(table)}`;
    if (count > 0) throw new Error(`Target table "${table}" is not empty`);
  }
}

async function importTables() {
  const rowsByTable = new Map<string, Row[]>();
  for (const table of TABLES_IN_DEPENDENCY_ORDER) {
    const types = await columnTypes(table);
    rowsByTable.set(
      table,
      sqliteRows(table).map((row) => convertRow(table, row, types)),
    );
  }

  await sql.begin(async (tx) => {
    for (const [table, rows] of rowsByTable) {
      for (let start = 0; start < rows.length; start += INSERT_BATCH_SIZE) {
        const batch = rows.slice(start, start + INSERT_BATCH_SIZE);
        await tx`INSERT INTO ${tx(table)} ${tx(batch)}`;
      }
      console.log(`${table}: imported ${rows.length}`);
    }
  });
}

async function verifyCounts() {
  const mismatches = [];
  for (const table of TABLES_IN_DEPENDENCY_ORDER) {
    const expected = sqliteRows(table).length;
    const [{ count }] = await sql<{ count: number }[]>`SELECT count(*)::int FROM ${sql(table)}`;
    if (count !== expected) mismatches.push(`${table}: D1 ${expected}, Postgres ${count}`);
  }

  if (mismatches.length > 0) throw new Error(`Row count mismatch\n${mismatches.join('\n')}`);
  console.log('Row counts match');
}

try {
  warnAboutUnknownTables();
  await assertTargetIsEmpty();
  await importTables();
  await verifyCounts();
} finally {
  await sql.end();
}
