import type { Database } from '$lib/server/db';
import { schema, type ClassBooking } from '$lib/server/db/schema';
import { CLASS_BOOKING_STATUS, CLASS_INSTANCE_STATUS } from '$lib/utils/classes';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ClassRepository } from './class.repository';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../db/migrations');
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
// migrations.spec.ts resets TEST_DATABASE_URL itself, so this suite uses its own database.
const DATABASE_NAME = 'orion_class_test';
const TEACHER = 'teacher@example.com';

describe.skipIf(!TEST_DATABASE_URL)(ClassRepository.name, () => {
  const admin = postgres(TEST_DATABASE_URL ?? '', { max: 1, onnotice: () => {} });
  const url = new URL(TEST_DATABASE_URL ?? 'postgres://localhost');
  url.pathname = `/${DATABASE_NAME}`;
  let sql: postgres.Sql;
  let db: Database;
  let repository: ClassRepository;

  beforeAll(async () => {
    await admin.unsafe(`DROP DATABASE IF EXISTS ${DATABASE_NAME} WITH (FORCE)`);
    await admin.unsafe(`CREATE DATABASE ${DATABASE_NAME}`);
    sql = postgres(url.toString(), { max: 1, onnotice: () => {} });
    db = drizzle(sql);
    await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
    repository = new ClassRepository(db);
    await db.insert(schema.user).values({ email: TEACHER, name: 'Teacher', picture: '' });
  });

  afterAll(async () => {
    await sql?.end();
    await admin.unsafe(`DROP DATABASE IF EXISTS ${DATABASE_NAME} WITH (FORCE)`);
    await admin.end();
  });

  beforeEach(async () => {
    await db.delete(schema.classBooking);
    await db.delete(schema.classInstance);
    await db.delete(schema.classCatalog);
  });

  async function addInstance(seats = 10) {
    const catalog = await repository.createCatalog({ name: 'Welding', description: '', price: 0 });
    return await repository.createInstance({
      classId: catalog.id,
      teacherEmail: TEACHER,
      date: '2099-01-01',
      startTime: '10:00',
      durationMinutes: 60,
      seats,
      status: CLASS_INSTANCE_STATUS.SCHEDULED,
    });
  }

  async function book(
    instanceId: string,
    quantity: number,
    status: ClassBooking['status'] = CLASS_BOOKING_STATUS.CONFIRMED,
  ) {
    return await repository.createBooking({
      instanceId,
      customerName: 'Ada',
      customerEmail: `${crypto.randomUUID()}@example.com`,
      customerPhone: '555',
      status,
      quantity,
    });
  }

  describe('getConfirmedSeatCounts', () => {
    it('sums confirmed seats per instance and skips canceled bookings', async () => {
      const first = await addInstance();
      const second = await addInstance();
      const empty = await addInstance();
      await book(first.id, 2);
      await book(first.id, 3);
      await book(first.id, 4, CLASS_BOOKING_STATUS.CANCELED);
      await book(second.id, 1);

      const counts = await repository.getConfirmedSeatCounts([first.id, second.id, empty.id]);

      expect(counts).toEqual(
        new Map([
          [first.id, 5],
          [second.id, 1],
        ]),
      );
    });

    it('returns no counts for no instances', async () => {
      expect(await repository.getConfirmedSeatCounts([])).toEqual(new Map());
    });
  });
});
