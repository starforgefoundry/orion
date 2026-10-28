import { schema } from '$lib/server/db/schema';
import { CarBayRepository } from '$lib/server/repositories/car_bay.repository';
import { CarBayRules, CarBaySlotTakenError, DEFAULT_CAR_BAY_POLICY } from '$lib/utils/car_bay';
import { EMAIL_TEMPLATE_KEYS } from '$lib/utils/email_templates';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { getTableConfig, type PgTable } from 'drizzle-orm/pg-core';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { DateTime } from 'luxon';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'migrations');
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

/**
 * A column that only exists in schema.ts never reaches the database, and the query that selects
 * it fails at runtime rather than at build time.
 */
describe.skipIf(!TEST_DATABASE_URL)('migrations', () => {
  const sql = postgres(TEST_DATABASE_URL ?? '', { max: 1, onnotice: () => {} });

  beforeAll(async () => {
    await sql`DROP SCHEMA IF EXISTS public CASCADE`;
    await sql`DROP SCHEMA IF EXISTS drizzle CASCADE`;
    await sql`CREATE SCHEMA public`;
    await migrate(drizzle(sql), { migrationsFolder: MIGRATIONS_DIR });
  });

  afterAll(async () => {
    await sql.end();
  });

  async function migratedColumns(table: string) {
    const rows = await sql<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${table}
    `;
    return rows.map((row) => row.column_name).toSorted();
  }

  function declaredColumns(table: PgTable) {
    return getTableConfig(table)
      .columns.map((column) => column.name)
      .toSorted();
  }

  it.each(Object.entries(schema))(
    '%s matches the columns the migrations create',
    async (_, table) => {
      const { name } = getTableConfig(table);

      expect(await migratedColumns(name)).toEqual(declaredColumns(table));
    },
  );

  it('creates every table the schema declares', async () => {
    const rows = await sql<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
    `;
    const created = new Set(rows.map((row) => row.table_name));

    const missing = Object.values(schema)
      .map((table) => getTableConfig(table).name)
      .filter((name) => !created.has(name));

    expect(missing).toEqual([]);
  });

  it('seeds every email template the app can send', async () => {
    const rows = await sql<{ key: string }[]>`SELECT key FROM email_template`;
    const seeded = new Set(rows.map((row) => row.key));

    expect(EMAIL_TEMPLATE_KEYS.filter((key) => !seeded.has(key))).toEqual([]);
  });

  it('round-trips timestamps without shifting them', async () => {
    const db = drizzle(sql);
    const signedDate = DateTime.fromISO('2026-03-08T01:30:00.123', { zone: 'America/Chicago' });
    await db
      .insert(schema.member)
      .values({ id: 'member-tz', name: 'Jane', email: 'jane@example.com' });
    await db.insert(schema.waiver).values({
      id: 'waiver-tz',
      memberId: 'member-tz',
      name: 'Jane',
      email: 'jane@example.com',
      signatureUrl: 'waivers/jane',
      signedDate,
    });

    const [stored] = await db.select().from(schema.waiver).where(eq(schema.waiver.id, 'waiver-tz'));
    await db.update(schema.waiver).set({ signedDate: stored.signedDate });
    const [resaved] = await db
      .select()
      .from(schema.waiver)
      .where(eq(schema.waiver.id, 'waiver-tz'));

    expect(stored.signedDate.toMillis()).toBe(signedDate.toMillis());
    expect(resaved.signedDate.toMillis()).toBe(signedDate.toMillis());
    expect(resaved.signedDate.zoneName).toBe('America/Chicago');
  });

  describe('car bay overlap constraint', () => {
    const repository = new CarBayRepository(drizzle(sql));

    function booking(start: string, end: string) {
      const endAt = DateTime.fromISO(end, { zone: 'America/Chicago' });
      return {
        tier: 'hourly' as const,
        status: 'confirmed' as const,
        startAt: DateTime.fromISO(start, { zone: 'America/Chicago' }),
        endAt,
        blockedUntil: new CarBayRules(DEFAULT_CAR_BAY_POLICY).blockedUntil(endAt),
        isMember: true,
        customerName: 'Jane Doe',
        customerEmail: 'jane@example.com',
        customerPhone: '555-0100',
      };
    }

    beforeEach(async () => {
      await sql`TRUNCATE car_bay_booking CASCADE`;
    });

    it('rejects a booking that overlaps a confirmed one', async () => {
      await repository.create(booking('2026-10-17T12:00', '2026-10-17T14:00'));

      await expect(
        repository.create(booking('2026-10-17T13:00', '2026-10-17T15:00')),
      ).rejects.toThrow(CarBaySlotTakenError);
    });

    it('rejects a booking that starts inside the 30 minute buffer', async () => {
      await repository.create(booking('2026-10-17T12:00', '2026-10-17T14:00'));

      await expect(
        repository.create(booking('2026-10-17T14:15', '2026-10-17T16:15')),
      ).rejects.toThrow(CarBaySlotTakenError);
      await expect(
        repository.create(booking('2026-10-17T14:30', '2026-10-17T16:30')),
      ).resolves.toBeDefined();
    });

    it('frees the time once a booking is canceled or a no-show', async () => {
      const canceled = await repository.create(booking('2026-10-17T12:00', '2026-10-17T14:00'));
      await repository.update(canceled.id, { status: 'canceled' });
      const noShow = await repository.create(booking('2026-10-17T12:00', '2026-10-17T14:00'));
      await repository.update(noShow.id, { status: 'no_show' });

      await expect(
        repository.create(booking('2026-10-17T12:00', '2026-10-17T14:00')),
      ).resolves.toBeDefined();
    });

    it('lets only one of two simultaneous checkouts win', async () => {
      const results = await Promise.allSettled([
        repository.create(booking('2026-10-17T12:00', '2026-10-17T14:00')),
        repository.create(booking('2026-10-17T13:00', '2026-10-17T15:00')),
      ]);

      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    });
  });
});

describe.skipIf(!TEST_DATABASE_URL)('member management migration', () => {
  const sql = postgres(TEST_DATABASE_URL ?? '', { max: 1, onnotice: () => {} });

  async function runMigrationFile(tag: string) {
    const contents = await readFile(join(MIGRATIONS_DIR, `${tag}.sql`), 'utf8');
    for (const statement of contents.split('--> statement-breakpoint')) {
      await sql.unsafe(statement);
    }
  }

  beforeAll(async () => {
    await sql`DROP SCHEMA IF EXISTS public CASCADE`;
    await sql`DROP SCHEMA IF EXISTS drizzle CASCADE`;
    await sql`CREATE SCHEMA public`;
    await runMigrationFile('0000_baseline');
    await runMigrationFile('0001_car_bay_booking');
    await sql`
      INSERT INTO waiver (id, name, email, signature_url, signed_date) VALUES
        ('w1', 'Old Name', 'Sam@Example.com ', 'waivers/w1', '2025-01-01T00:00:00Z'),
        ('w2', 'New Name', 'sam@example.com', 'waivers/w2', '2026-01-01T00:00:00Z'),
        ('w3', 'Alex', 'alex@example.com', 'waivers/w3', '2025-06-01T00:00:00Z')
    `;
    await runMigrationFile('0002_member_management');
  });

  afterAll(async () => {
    await sql.end();
  });

  it('creates one member per waiver email using the latest name', async () => {
    const members = await sql<{ email: string; name: string }[]>`
      SELECT email, name FROM member ORDER BY email
    `;

    expect(members).toEqual([
      { email: 'alex@example.com', name: 'Alex' },
      { email: 'sam@example.com', name: 'New Name' },
    ]);
  });

  it('links every waiver to its member', async () => {
    const rows = await sql<{ id: string; email: string }[]>`
      SELECT waiver.id, member.email FROM waiver JOIN member ON member.id = waiver.member_id
      ORDER BY waiver.id
    `;

    expect(rows).toEqual([
      { id: 'w1', email: 'sam@example.com' },
      { id: 'w2', email: 'sam@example.com' },
      { id: 'w3', email: 'alex@example.com' },
    ]);
  });
});

describe.skipIf(!TEST_DATABASE_URL)('unified payments migration', () => {
  const sql = postgres(TEST_DATABASE_URL ?? '', { max: 1, onnotice: () => {} });
  const SQUARE_ORDER = {
    lineItems: [
      { name: '3D Print Request', quantity: '1', basePriceMoney: { amount: '700' } },
      { name: 'Additional Build Plate', quantity: '2', basePriceMoney: { amount: '250' } },
    ],
    discounts: [{ name: 'Member Discount', appliedMoney: { amount: '120' } }],
  };

  async function runMigrationFile(tag: string) {
    const contents = await readFile(join(MIGRATIONS_DIR, `${tag}.sql`), 'utf8');
    for (const statement of contents.split('--> statement-breakpoint')) {
      await sql.unsafe(statement);
    }
  }

  beforeAll(async () => {
    await sql`DROP SCHEMA IF EXISTS public CASCADE`;
    await sql`DROP SCHEMA IF EXISTS drizzle CASCADE`;
    await sql`CREATE SCHEMA public`;
    for (const tag of [
      '0000_baseline',
      '0001_car_bay_booking',
      '0002_member_management',
      '0003_car_bay_closure',
    ]) {
      await runMigrationFile(tag);
    }

    await sql`INSERT INTO "user" (email, name, picture) VALUES ('teacher@example.com', 'T', 'p')`;
    await sql`INSERT INTO organization (id, name, email) VALUES ('org-1', 'Acme', 'acme@example.com')`;
    await sql`INSERT INTO print_material (id, name) VALUES ('pla', 'PLA')`;
    await sql`
      INSERT INTO billing_code (id, code, description, organization_id, discount_id) VALUES
        ('code-org', 'ACME', 'Acme', 'org-1', NULL),
        ('code-discount', 'STUDENT', 'Students', NULL, 'square-discount')
    `;
    await sql`
      INSERT INTO payment (id, issued_date, status, type, total, square_invoice_id, payment_url, order_object)
      VALUES ('print-payment', now(), 'pending', 'print_request', 1080, 'invoice-1',
        'https://square.link/u/1', ${JSON.stringify(SQUARE_ORDER)})
    `;
    await sql`
      INSERT INTO print_request ("submissionDate", id, email, customer_name, project_name, status, material, special_requests, payment_id)
      VALUES (now(), 'print-1', 'jane@example.com', 'Jane Doe', 'Arm', 'printing', 'pla', '', 'print-payment')
    `;
    await sql`
      INSERT INTO payment (id, issued_date, status, type, total, organization_id) VALUES
        ('balance-1', now(), 'pending', 'balance', 5000, 'org-1'),
        ('charge-payment', now(), 'paid', 'org_charge', 2500, 'org-1')
    `;
    await sql`
      INSERT INTO organization_charge (id, organization_id, creation_date, description, payment_id)
      VALUES ('charge-1', 'org-1', now(), 'Laser time', 'charge-payment')
    `;
    await sql`
      INSERT INTO class_catalog (id, name, description, price, created_date)
      VALUES ('welding', 'Welding 101', '', 4000, now())
    `;
    await sql`
      INSERT INTO class_instance (id, class_id, teacher_email, date, start_time, duration_minutes, seats, created_date)
      VALUES ('class-1', 'welding', 'teacher@example.com', '2026-11-01', '18:00', 60, 5, now())
    `;
    await sql`
      INSERT INTO class_booking (id, instance_id, customer_name, customer_email, customer_phone,
        square_payment_id, status, quantity, amount_paid, booking_token, created_date) VALUES
        ('class-paid', 'class-1', 'Ann', 'ann@example.com', '1', 'sq-1', 'confirmed', 2, 8000, 't1', now()),
        ('class-canceled', 'class-1', 'Bo', 'bo@example.com', '1', 'sq-2', 'canceled', 1, 4000, 't2', now()),
        ('class-free', 'class-1', 'Cy', 'cy@example.com', '1', NULL, 'confirmed', 1, 0, 't3', now()),
        ('class-uneven', 'class-1', 'Di', 'di@example.com', '1', 'sq-9', 'confirmed', 3, 10000, 't6', now())
    `;
    await sql`
      INSERT INTO car_bay_booking (id, tier, status, start_at, end_at, blocked_until, is_member,
        customer_name, customer_email, customer_phone, amount_paid, square_payment_id,
        square_order_id, booking_token, created_date) VALUES
        ('bay-paid', 'hourly', 'confirmed', now(), now() + interval '2 hours',
          now() + interval '3 hours', true, 'Dee', 'dee@example.com', '1', 2000, 'sq-3', 'order-3', 't4', now()),
        ('bay-staff', 'quick_job', 'confirmed', now() + interval '1 day', now() + interval '25 hours',
          now() + interval '26 hours', false, 'Eve', 'eve@example.com', '1', 0, NULL, NULL, 't5', now())
    `;
    await sql`
      INSERT INTO payment (id, issued_date, status, type, total, square_invoice_id, car_bay_booking_id)
      VALUES ('overrun-1', now(), 'pending', 'car_bay_overrun', 1500, 'invoice-2', 'bay-paid')
    `;

    await runMigrationFile('0004_unified_payments');
  });

  afterAll(async () => {
    await sql.end();
  });

  async function paymentRow(id: string) {
    const [row] = await sql`
      SELECT type, status, total, customer_name, customer_email, line_items, discounts,
        square_payment_id, square_invoice_id, payment_url
      FROM payment WHERE id = ${id}
    `;
    return row;
  }

  it('turns a Square print order into line items and discounts', async () => {
    expect(await paymentRow('print-payment')).toMatchObject({
      customer_name: 'Jane Doe',
      customer_email: 'jane@example.com',
      line_items: [
        { name: '3D Print Request', quantity: 1, unitAmount: 700 },
        { name: 'Additional Build Plate', quantity: 2, unitAmount: 250 },
      ],
      discounts: [{ name: 'Member Discount', amount: 120 }],
      square_invoice_id: 'invoice-1',
      payment_url: 'https://square.link/u/1',
    });
  });

  it('gives organization payments a line item and the organization as customer', async () => {
    expect(await paymentRow('balance-1')).toMatchObject({
      customer_name: 'Acme',
      line_items: [{ name: 'Organization Balance Payment', quantity: 1, unitAmount: 5000 }],
    });
    expect(await paymentRow('charge-payment')).toMatchObject({
      line_items: [{ name: 'Laser time', quantity: 1, unitAmount: 2500 }],
    });
  });

  it('moves paid class bookings into payments', async () => {
    expect(await paymentRow('class-paid')).toMatchObject({
      type: 'class_booking',
      status: 'paid',
      total: 8000,
      square_payment_id: 'sq-1',
      line_items: [{ name: 'Welding 101', quantity: 2, unitAmount: 4000 }],
    });
    expect((await paymentRow('class-canceled')).status).toBe('refunded');

    const bookings = await sql`SELECT id, payment_id FROM class_booking ORDER BY id`;
    expect(bookings).toEqual([
      { id: 'class-canceled', payment_id: 'class-canceled' },
      { id: 'class-free', payment_id: null },
      { id: 'class-paid', payment_id: 'class-paid' },
      { id: 'class-uneven', payment_id: 'class-uneven' },
    ]);
  });

  it('keeps a class total that does not split evenly per seat as one line', async () => {
    expect(await paymentRow('class-uneven')).toMatchObject({
      total: 10000,
      line_items: [{ name: 'Welding 101 (3 seats)', quantity: 1, unitAmount: 10000 }],
    });
  });

  it('moves paid car bay bookings and their overruns into payments', async () => {
    expect(await paymentRow('bay-paid')).toMatchObject({
      type: 'car_bay_booking',
      status: 'paid',
      total: 2000,
      customer_email: 'dee@example.com',
      line_items: [{ name: 'Car Bay - Hourly', quantity: 1, unitAmount: 2000 }],
    });
    expect((await paymentRow('overrun-1')).customer_email).toBe('dee@example.com');

    const [overrun] = await sql`SELECT booking_id, payment_id FROM car_bay_overrun`;
    expect(overrun).toEqual({ booking_id: 'bay-paid', payment_id: 'overrun-1' });

    const bookings = await sql`SELECT id, payment_id FROM car_bay_booking ORDER BY id`;
    expect(bookings).toEqual([
      { id: 'bay-paid', payment_id: 'bay-paid' },
      { id: 'bay-staff', payment_id: null },
    ]);
  });

  it('archives group codes that only gave a discount', async () => {
    const codes = await sql`SELECT code, archived FROM billing_code ORDER BY code`;

    expect(codes).toEqual([
      { code: 'ACME', archived: false },
      { code: 'STUDENT', archived: true },
    ]);
  });
});

describe.skipIf(!TEST_DATABASE_URL)('booking passes migration', () => {
  const sql = postgres(TEST_DATABASE_URL ?? '', { max: 1, onnotice: () => {} });
  const EDITED_BODY = '<p>Our own car bay confirmation</p>';

  async function runMigrationFile(tag: string) {
    const contents = await readFile(join(MIGRATIONS_DIR, `${tag}.sql`), 'utf8');
    for (const statement of contents.split('--> statement-breakpoint')) {
      await sql.unsafe(statement);
    }
  }

  async function templateBody(key: string) {
    const [row] = await sql<{ body: string }[]>`SELECT body FROM email_template WHERE key = ${key}`;
    return row.body;
  }

  beforeAll(async () => {
    await sql`DROP SCHEMA IF EXISTS public CASCADE`;
    await sql`DROP SCHEMA IF EXISTS drizzle CASCADE`;
    await sql`CREATE SCHEMA public`;
    for (const tag of [
      '0000_baseline',
      '0001_car_bay_booking',
      '0002_member_management',
      '0003_car_bay_closure',
      '0004_unified_payments',
      '0005_email_templates',
    ]) {
      await runMigrationFile(tag);
    }
    await sql`UPDATE email_template SET body = ${EDITED_BODY} WHERE key = 'car_bay_booking'`;

    await runMigrationFile('0006_booking_passes');
  });

  afterAll(async () => {
    await sql.end();
  });

  it('adds the pass to templates staff have not edited', async () => {
    expect(await templateBody('class_booking')).toContain('{{passQrImageUrl}}');
    expect(await templateBody('car_bay_reminder')).toContain('{{passQrImageUrl}}');
  });

  it('keeps templates staff have edited', async () => {
    expect(await templateBody('car_bay_booking')).toBe(EDITED_BODY);
  });
});
