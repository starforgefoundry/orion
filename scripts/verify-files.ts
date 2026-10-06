/**
 * Usage: node scripts/verify-files.ts
 *
 * Checks that every file key stored in Postgres exists under STORAGE_DIR.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';

const FILE_COLUMNS = [
  { table: 'print_request_file', column: 'file_url' },
  { table: 'print_request_comment_file', column: 'file_url' },
  { table: 'inventory_item', column: 'image_url' },
  { table: 'waiver', column: 'signature_url' },
  { table: 'class_catalog', column: 'photo_url' },
];

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
if (!process.env.STORAGE_DIR) throw new Error('STORAGE_DIR is not set');

const storageDir = process.env.STORAGE_DIR;
const sql = postgres(process.env.DATABASE_URL, { max: 1 });

try {
  const missing = [];
  for (const { table, column } of FILE_COLUMNS) {
    const rows = await sql<{ key: string }[]>`
      SELECT ${sql(column)} AS key FROM ${sql(table)} WHERE ${sql(column)} IS NOT NULL
    `;
    for (const { key } of rows) {
      if (!existsSync(join(storageDir, key))) missing.push(`${table}.${column}: ${key}`);
    }
    console.log(`${table}.${column}: checked ${rows.length}`);
  }

  if (missing.length > 0) throw new Error(`Missing files\n${missing.join('\n')}`);
  console.log('All files present');
} finally {
  await sql.end();
}
