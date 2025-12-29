import { getRequestEvent } from '$app/server';
import { env } from '$env/dynamic/private';
import { createClient } from '@libsql/client';
import { drizzle as drizzleD1, type DrizzleD1Database } from 'drizzle-orm/d1';
import { drizzle as drizzleLibSql, type LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from './schema';

export function createLibSqlClient(url: string): LibSQLDatabase<typeof schema> {
  const client = createClient({ url });
  return drizzleLibSql(client);
}

export function createD1Client(database: D1Database): DrizzleD1Database<typeof schema> {
  return drizzleD1(database);
}

export type DrizzleClient =
  | ReturnType<typeof createLibSqlClient>
  | ReturnType<typeof createD1Client>;

export function getDB() {
  const event = getRequestEvent();
  if (!event.platform?.env.DB && !env.DATABASE_URL)
    throw new Error('No database found in environment');

  return env.DATABASE_URL
    ? createLibSqlClient(env.DATABASE_URL)
    : createD1Client(event.platform!.env.DB);
}
