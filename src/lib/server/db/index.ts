import { env } from '$env/dynamic/private';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

function connect() {
  return drizzle(postgres(env.DATABASE_URL ?? ''));
}

export type Database = ReturnType<typeof connect>;

let db: Database | undefined;

export function getDB() {
  db ??= connect();
  return db;
}
