import type { Database } from '$lib/server/db';
import { schema } from '$lib/server/db/schema';
import { PAYMENT_STATUS, PAYMENT_TYPE } from '$lib/utils/billing';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PaymentDeclinedError,
  PaymentRepository,
  PaymentStateError,
  type NewPayment,
} from './payment.repository';

vi.mock('$env/dynamic/private', () => ({ env: {} }));

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

describe.skipIf(!TEST_DATABASE_URL)('PaymentRepository', () => {
  const admin = postgres(TEST_DATABASE_URL ?? '', { max: 1, onnotice: () => {} });
  const url = new URL(TEST_DATABASE_URL ?? 'postgres://localhost');
  url.pathname = `/${DATABASE_NAME}`;
  let sql: postgres.Sql;
  let db: Database;
  let square: any;
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
    square = {
      upsertCustomer: vi.fn(async () => ({ id: 'customer-1' })),
      createOrder: vi.fn(async () => ({ id: 'order-1' })),
      createPayment: vi.fn(async ({ autocomplete }) => ({
        id: 'square-payment-1',
        status: autocomplete ? 'COMPLETED' : 'APPROVED',
      })),
      completePayment: vi.fn(),
      cancelPayment: vi.fn(),
      refundPayment: vi.fn(),
      cancelInvoice: vi.fn(),
    };
    const settings = { getSetting: vi.fn(async () => ({ locationId: 'location-1' })) };
    repository = new PaymentRepository(db, undefined, square, settings as any);
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

  describe('pay', () => {
    it('charges the card for an order that matches the bill', async () => {
      const saved = await repository.save(NEW_PAYMENT);

      const paid = await repository.pay(saved, 'card-token');

      expect(square.createOrder.mock.calls[0][0].order).toMatchObject({
        locationId: 'location-1',
        customerId: 'customer-1',
        referenceId: saved.id,
        lineItems: [
          {
            name: '3D Print Material',
            note: 'PLA',
            quantity: '1',
            basePriceMoney: { amount: 700n },
          },
          { name: 'Additional Build Plate', quantity: '2', basePriceMoney: { amount: 250n } },
        ],
        discounts: [
          { name: 'Member Discount (10%)', type: 'FIXED_AMOUNT', amountMoney: { amount: 120n } },
        ],
      });
      expect(square.createPayment.mock.calls[0][0]).toMatchObject({
        sourceId: 'card-token',
        amountMoney: { amount: 1080n },
        orderId: 'order-1',
        autocomplete: true,
      });
      expect(paid).toMatchObject({
        status: PAYMENT_STATUS.PAID,
        squareOrderId: 'order-1',
        squarePaymentId: 'square-payment-1',
      });
    });

    it('reports a declined card without marking the bill paid', async () => {
      const saved = await repository.save(NEW_PAYMENT);
      square.createPayment.mockRejectedValue(new Error('CARD_DECLINED'));

      await expect(repository.pay(saved, 'card-token')).rejects.toThrow(PaymentDeclinedError);
      expect((await repository.getById(saved.id)).status).toBe(PAYMENT_STATUS.PENDING);
    });

    it('refuses a bill whose line items do not add up to its total', async () => {
      const saved = await repository.save({ ...NEW_PAYMENT, bill: { ...BILL, total: 999 } });

      await expect(repository.pay(saved, 'card-token')).rejects.toThrow('do not add up');
      expect(square.createPayment).not.toHaveBeenCalled();
    });

    it('refuses a bill that is not waiting to be paid', async () => {
      const saved = await repository.save({ ...NEW_PAYMENT, status: PAYMENT_STATUS.QUOTE });

      await expect(repository.pay(saved, 'card-token')).rejects.toThrow('not waiting');
    });

    it('charges only once when the customer pays twice at the same time', async () => {
      const saved = await repository.save(NEW_PAYMENT);

      const results = await Promise.allSettled([
        repository.pay(saved, 'card-token-1'),
        repository.pay(saved, 'card-token-2'),
      ]);

      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(square.createPayment).toHaveBeenCalledOnce();
      expect((await repository.getById(saved.id)).status).toBe(PAYMENT_STATUS.PAID);
    });

    it('charges the bill as stored, not a copy the caller read earlier', async () => {
      const stale = await repository.save(NEW_PAYMENT);
      await repository.save(
        {
          ...NEW_PAYMENT,
          bill: {
            lineItems: [{ name: 'Repriced', quantity: 1, unitAmount: 500 }],
            discounts: [],
            total: 500,
          },
        },
        stale.id,
      );

      const paid = await repository.pay(stale, 'card-token');

      expect(square.createPayment.mock.calls[0][0].amountMoney.amount).toBe(500n);
      expect(paid?.total).toBe(500);
    });

    it('lets the customer try again after a declined card', async () => {
      const saved = await repository.save(NEW_PAYMENT);
      square.createPayment.mockRejectedValueOnce(new Error('CARD_DECLINED'));

      await expect(repository.pay(saved, 'bad-card')).rejects.toThrow(PaymentDeclinedError);
      expect((await repository.pay(saved, 'good-card'))?.status).toBe(PAYMENT_STATUS.PAID);
    });
  });

  describe('authorize and capture', () => {
    it('holds the card, then takes the money on capture', async () => {
      const held = await repository.authorize(NEW_PAYMENT, 'card-token');

      expect(square.createPayment.mock.calls[0][0].autocomplete).toBe(false);
      expect(held.status).toBe(PAYMENT_STATUS.PENDING);

      const captured = await repository.capture(held);

      expect(square.completePayment).toHaveBeenCalledWith('square-payment-1');
      expect(captured.status).toBe(PAYMENT_STATUS.PAID);
    });

    it('cancels the payment when the card is declined', async () => {
      square.createPayment.mockResolvedValue({ id: 'square-payment-1', status: 'FAILED' });

      await expect(repository.authorize(NEW_PAYMENT, 'card-token')).rejects.toThrow(
        PaymentDeclinedError,
      );
      const [stored] = await db.select().from(schema.payment);
      expect(stored.status).toBe(PAYMENT_STATUS.CANCELED);
    });

    it('voids the hold when capture fails', async () => {
      const held = await repository.authorize(NEW_PAYMENT, 'card-token');
      square.completePayment.mockRejectedValue(new Error('expired'));

      await expect(repository.capture(held)).rejects.toThrow(PaymentDeclinedError);
      expect(square.cancelPayment).toHaveBeenCalledWith('square-payment-1');
      expect((await repository.getById(held.id)).status).toBe(PAYMENT_STATUS.CANCELED);
    });
  });

  describe('refund', () => {
    it('refunds the full amount and marks the payment refunded', async () => {
      const paid = await repository.capture(await repository.authorize(NEW_PAYMENT, 'card-token'));

      expect(await repository.refund(paid)).toBe(true);
      expect(square.refundPayment).toHaveBeenCalledWith('square-payment-1', 1080);
      expect(await repository.getById(paid.id)).toMatchObject({
        status: PAYMENT_STATUS.REFUNDED,
      });
    });

    it('does nothing for a payment that was never paid', async () => {
      const pending = await repository.save(NEW_PAYMENT);

      expect(await repository.refund(pending)).toBe(false);
      expect(square.refundPayment).not.toHaveBeenCalled();
    });
  });

  describe('approveQuote', () => {
    it('only approves a quote once', async () => {
      const quote = await repository.save({ ...NEW_PAYMENT, status: PAYMENT_STATUS.QUOTE });

      expect((await repository.approveQuote(quote))?.status).toBe(PAYMENT_STATUS.PENDING);
      expect(await repository.approveQuote(quote)).toBeUndefined();
    });
  });

  describe('cancel', () => {
    it('cancels the Square invoice of a payment made before Orion billing', async () => {
      const saved = await repository.save(NEW_PAYMENT);
      const legacy = await repository.update(saved.id, { squareInvoiceId: 'invoice-1' });

      await repository.cancel(legacy);

      expect(square.cancelInvoice).toHaveBeenCalledWith('invoice-1');
      expect((await repository.getById(saved.id)).status).toBe(PAYMENT_STATUS.CANCELED);
    });
  });
});
