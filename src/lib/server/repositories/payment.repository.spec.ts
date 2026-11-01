import type { Database } from '$lib/server/db';
import { schema } from '$lib/server/db/schema';
import { PAYMENT_STATUS, PAYMENT_TYPE } from '$lib/utils/billing';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PaymentRepository, PaymentStateError, type NewPayment } from './payment.repository';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../db/migrations');
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
// migrations.spec.ts resets TEST_DATABASE_URL itself, so this suite uses its own database.
const DATABASE_NAME = 'orion_payment_test';

const BILL = {
  lineItems: [
    { name: '3D Print Material', description: 'PLA', quantity: 1, unitAmount: 700 },
    { name: 'Additional Build Plate', quantity: 2, unitAmount: 250 },
  ],
  discounts: [{ name: 'Member Discount (10%)', amount: 120 }],
  total: 1080,
};

const NEW_PAYMENT: NewPayment = {
  type: PAYMENT_TYPE.PRINT_REQUEST,
  status: PAYMENT_STATUS.PENDING,
  customer: { name: 'Jane Doe', email: 'jane@example.com' },
  bill: BILL,
};

describe.skipIf(!TEST_DATABASE_URL)(PaymentRepository.name, () => {
  const admin = postgres(TEST_DATABASE_URL ?? '', { max: 1, onnotice: () => {} });
  const url = new URL(TEST_DATABASE_URL ?? 'postgres://localhost');
  url.pathname = `/${DATABASE_NAME}`;
  let sql: postgres.Sql;
  let db: Database;
  let repository: PaymentRepository;

  beforeAll(async () => {
    await admin.unsafe(`DROP DATABASE IF EXISTS ${DATABASE_NAME} WITH (FORCE)`);
    await admin.unsafe(`CREATE DATABASE ${DATABASE_NAME}`);
    sql = postgres(url.toString(), { max: 1, onnotice: () => {} });
    db = drizzle(sql);
    await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  });

  afterAll(async () => {
    await sql?.end();
    await admin.unsafe(`DROP DATABASE IF EXISTS ${DATABASE_NAME} WITH (FORCE)`);
    await admin.end();
  });

  beforeEach(async () => {
    await db.delete(schema.payment);
    repository = new PaymentRepository(db);
  });

  describe('save', () => {
    it('stores the bill with its line items and customer', async () => {
      const saved = await repository.save(NEW_PAYMENT);

      expect(await repository.getById(saved.id)).toMatchObject({
        status: PAYMENT_STATUS.PENDING,
        customerName: 'Jane Doe',
        customerEmail: 'jane@example.com',
        lineItems: BILL.lineItems,
        discounts: BILL.discounts,
        total: 1080,
      });
    });

    it('marks a bill for nothing as paid', async () => {
      const saved = await repository.save({
        ...NEW_PAYMENT,
        bill: { lineItems: [], discounts: [], total: 0 },
      });

      expect(saved.status).toBe(PAYMENT_STATUS.PAID);
      expect(saved.paymentDate).not.toBeNull();
    });

    it('replaces an existing bill and forgets its Square invoice', async () => {
      const first = await repository.save(NEW_PAYMENT);
      await repository.update(first.id, { squareInvoiceId: 'invoice-1' });

      const second = await repository.save(
        { ...NEW_PAYMENT, bill: { ...BILL, total: 500, discounts: [], lineItems: [] } },
        first.id,
      );

      expect(second.id).toBe(first.id);
      expect(second.total).toBe(500);
      expect(second.squareInvoiceId).toBeNull();
    });

    it.each([
      PAYMENT_STATUS.PROCESSING,
      PAYMENT_STATUS.PAID,
      PAYMENT_STATUS.CANCELED,
      PAYMENT_STATUS.REFUNDED,
    ])('will not overwrite a %s payment', async (status) => {
      const first = await repository.save(NEW_PAYMENT);
      await repository.update(first.id, { status });

      await expect(
        repository.save({ ...NEW_PAYMENT, bill: { ...BILL, total: 500 } }, first.id),
      ).rejects.toThrow(PaymentStateError);
      expect(await repository.getById(first.id)).toMatchObject({ status, total: 1080 });
    });
  });

  describe('approveQuote', () => {
    it('only approves a quote once', async () => {
      const quote = await repository.save({ ...NEW_PAYMENT, status: PAYMENT_STATUS.QUOTE });

      expect((await repository.approveQuote(quote))?.status).toBe(PAYMENT_STATUS.PENDING);
      expect(await repository.approveQuote(quote)).toBeUndefined();
    });
  });

  describe('transition', () => {
    it('moves a payment out of a status only once when two callers race', async () => {
      const saved = await repository.save(NEW_PAYMENT);
      const claim = () =>
        repository.transition(saved.id, PAYMENT_STATUS.PENDING, {
          status: PAYMENT_STATUS.PROCESSING,
        });

      const results = await Promise.all([claim(), claim()]);

      expect(results.filter(Boolean)).toHaveLength(1);
      expect((await repository.getById(saved.id)).status).toBe(PAYMENT_STATUS.PROCESSING);
    });

    it('returns the stored row, not a copy the caller read earlier', async () => {
      const stale = await repository.save(NEW_PAYMENT);
      await repository.save({ ...NEW_PAYMENT, bill: { ...BILL, total: 500 } }, stale.id);

      const claimed = await repository.transition(stale.id, PAYMENT_STATUS.PENDING, {
        status: PAYMENT_STATUS.PROCESSING,
      });

      expect(claimed?.total).toBe(500);
    });
  });

  describe('markPaid', () => {
    it('marks a pending payment paid with a payment date', async () => {
      const saved = await repository.save(NEW_PAYMENT);

      const paid = await repository.markPaid(saved.id);

      expect(paid?.status).toBe(PAYMENT_STATUS.PAID);
      expect(paid?.paymentDate).not.toBeNull();
    });
  });
});
