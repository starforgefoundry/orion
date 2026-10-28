import { env } from '$env/dynamic/private';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

function connect() {
  return drizzle(postgres(env.DATABASE_URL ?? ''));
}

export type Database = ReturnType<typeof connect>;

// Vite re-runs this module on every hot reload, so a module-level cache would open a new pool each time.
const cache = globalThis as typeof globalThis & { orionDB?: Database };

export function getDB() {
  cache.orionDB ??= connect();
  return cache.orionDB;
}
