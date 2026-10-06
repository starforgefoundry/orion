import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const MIGRATIONS_FOLDER = fileURLToPath(
  new URL('../src/lib/server/db/migrations', import.meta.url),
);

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

const client = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });

try {
  await migrate(drizzle(client), { migrationsFolder: MIGRATIONS_FOLDER });
  console.log('Migrations applied');
} finally {
  await client.end();
}
