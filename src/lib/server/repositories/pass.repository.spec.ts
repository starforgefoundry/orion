import { PASS_KIND } from '$lib/member_enums';
import type { Database } from '$lib/server/db';
import { schema } from '$lib/server/db/schema';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { eq } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PassRepository } from './pass.repository';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../db/migrations');
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
// migrations.spec.ts resets TEST_DATABASE_URL itself, so this suite uses its own database.
const DATABASE_NAME = 'orion_pass_test';

describe.skipIf(!TEST_DATABASE_URL)(PassRepository.name, () => {
  const now = DateTime.now();
  const admin = postgres(TEST_DATABASE_URL ?? '', { max: 1, onnotice: () => {} });
  const url = new URL(TEST_DATABASE_URL ?? 'postgres://localhost');
  url.pathname = `/${DATABASE_NAME}`;
  let sql: postgres.Sql;
  let db: Database;
  let repository: PassRepository;

  async function addMember(name: string) {
    const [member] = await db
      .insert(schema.member)
      .values({ name, email: `${name}@example.com` })
      .returning();
    return member;
  }

  async function addClassBooking(memberId: string | null) {
    await db
      .insert(schema.user)
      .values({ email: 'teacher@example.com', name: 'Teacher', picture: '' })
      .onConflictDoNothing();
    const [catalog] = await db
      .insert(schema.classCatalog)
      .values({ name: 'Intro to Welding', description: '', price: 5000 })
      .returning();
    const [instance] = await db
      .insert(schema.classInstance)
      .values({
        classId: catalog.id,
        teacherEmail: 'teacher@example.com',
        date: '2026-10-20',
        startTime: '18:00',
        durationMinutes: 60,
        seats: 5,
      })
      .returning();
    const [booking] = await db
      .insert(schema.classBooking)
      .values({
        instanceId: instance.id,
        memberId,
        customerName: 'Booker',
        customerEmail: 'booker@example.com',
        customerPhone: '555-0100',
        status: 'confirmed',
      })
      .returning();
    return booking;
  }

  async function addCarBayBooking(memberId: string | null, startAt: DateTime) {
    const [booking] = await db
      .insert(schema.carBayBooking)
      .values({
        tier: 'hourly',
        status: 'confirmed',
        startAt,
        endAt: startAt.plus({ hours: 1 }),
        blockedUntil: startAt.plus({ hours: 1, minutes: 30 }),
        isMember: false,
        memberId,
        customerName: 'Driver',
        customerEmail: 'driver@example.com',
        customerPhone: '555-0100',
      })
      .returning();
    return booking;
  }

  beforeAll(async () => {
    await admin.unsafe(`DROP DATABASE IF EXISTS ${DATABASE_NAME} WITH (FORCE)`);
    await admin.unsafe(`CREATE DATABASE ${DATABASE_NAME}`);
    sql = postgres(url.toString(), { max: 1, onnotice: () => {} });
    db = drizzle(sql);
    await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
    repository = new PassRepository(db);
  });

  afterAll(async () => {
    await sql?.end();
    await admin.unsafe(`DROP DATABASE IF EXISTS ${DATABASE_NAME} WITH (FORCE)`);
    await admin.end();
  });

  it('returns undefined for an unknown token', async () => {
    expect(await repository.getByToken(crypto.randomUUID())).toBeUndefined();
  });

  it('finds a membership by the member pass token', async () => {
    const member = await addMember('member');

    expect(await repository.getByToken(member.passToken)).toEqual({
      kind: PASS_KIND.MEMBERSHIP,
      passToken: member.passToken,
      member,
    });
  });

  it('finds a day pass with its holder', async () => {
    const member = await addMember('day');
    const [dayPass] = await db
      .insert(schema.dayPass)
      .values({ memberId: member.id, squareOrderId: 'order', purchasedDate: now })
      .returning();

    expect(await repository.getByToken(dayPass.passToken)).toMatchObject({
      kind: PASS_KIND.DAY_PASS,
      member: { id: member.id },
      dayPass: { id: dayPass.id },
    });
  });

  it('gives every row its own pass token', async () => {
    const member = await addMember('several');
    const rows = await db
      .insert(schema.dayPass)
      .values([
        { memberId: member.id, squareOrderId: 'order-a', purchasedDate: now },
        { memberId: member.id, squareOrderId: 'order-b', purchasedDate: now },
      ])
      .returning();

    expect(new Set(rows.map((row) => row.passToken)).size).toBe(rows.length);
  });

  it('finds a class pass with its class', async () => {
    const member = await addMember('student');
    const booking = await addClassBooking(member.id);

    expect(await repository.getByToken(booking.passToken)).toMatchObject({
      kind: PASS_KIND.CLASS,
      member: { id: member.id },
      booking: { id: booking.id },
      instance: { date: '2026-10-20' },
      catalog: { name: 'Intro to Welding' },
    });
  });

  it('finds a car bay pass whose booking has no member yet', async () => {
    const booking = await addCarBayBooking(null, now);

    expect(await repository.getByToken(booking.passToken)).toMatchObject({
      kind: PASS_KIND.CAR_BAY,
      member: null,
      booking: { id: booking.id },
    });
  });

  it('links a booking to a member', async () => {
    const member = await addMember('driver');
    const booking = await addCarBayBooking(null, now.plus({ days: 1 }));
    const pass = await repository.getByToken(booking.passToken);
    if (pass?.kind !== PASS_KIND.CAR_BAY) throw new Error('Expected a car bay pass');

    await repository.linkMember(pass, member.id);

    const [linked] = await db
      .select({ memberId: schema.carBayBooking.memberId })
      .from(schema.carBayBooking)
      .where(eq(schema.carBayBooking.id, booking.id));
    expect(linked.memberId).toBe(member.id);
  });
});
