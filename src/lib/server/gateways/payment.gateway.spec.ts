import type { Payment } from '$lib/server/db/schema';
import {
  PaymentRepository,
  PaymentStateError,
  type NewPayment,
} from '$lib/server/repositories/payment.repository';
import { SettingsRepository } from '$lib/server/repositories/settings.repository';
import { SquareRepository } from '$lib/server/repositories/square.repository';
import { PAYMENT_STATUS, PAYMENT_TYPE } from '$lib/utils/billing';
import { factory } from '$test/factory';
import { automock, stubSettings } from '$test/utils';
import { beforeEach, describe, expect, it, type Mocked } from 'vitest';
import { PaymentDeclinedError, PaymentGateway } from './payment.gateway';

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

function storedPayment(overrides: Partial<Payment> = {}) {
  return factory.payment({
    id: 'payment-1',
    status: PAYMENT_STATUS.PENDING,
    customerName: 'Jane Doe',
    customerEmail: 'jane@example.com',
    lineItems: BILL.lineItems,
    discounts: BILL.discounts,
    total: BILL.total,
    ...overrides,
  });
}

describe(PaymentGateway.name, () => {
  let payments: Mocked<PaymentRepository>;
  let square: Mocked<SquareRepository>;
  let gateway: PaymentGateway;

  beforeEach(() => {
    payments = automock(PaymentRepository);
    payments.update.mockImplementation(async (id, updates) =>
      storedPayment({ id, ...(updates as Partial<Payment>) }),
    );
    payments.transition.mockImplementation(async (id, _from, updates) =>
      storedPayment({ id, ...(updates as Partial<Payment>) }),
    );
    square = automock(SquareRepository);
    square.upsertCustomer.mockResolvedValue(factory.squareCustomer({ id: 'customer-1' }));
    square.createOrder.mockResolvedValue(factory.squareOrder({ id: 'order-1' }));
    square.createPayment.mockImplementation(async ({ autocomplete }) => ({
      id: 'square-payment-1',
      status: autocomplete ? 'COMPLETED' : 'APPROVED',
    }));
    square.completePayment.mockResolvedValue(undefined);
    square.cancelPayment.mockResolvedValue(undefined);
    square.refundPayment.mockResolvedValue(undefined);
    square.cancelInvoice.mockResolvedValue(undefined);
    const settings = automock(SettingsRepository);
    stubSettings(settings, { printRequestSquare: { locationId: 'location-1' } });
    gateway = new PaymentGateway(payments, square, settings);
  });

  describe('pay', () => {
    it('charges the card for an order that matches the bill', async () => {
      const paid = await gateway.pay(storedPayment(), 'card-token');

      expect(square.createOrder.mock.calls[0][0].order).toMatchObject({
        locationId: 'location-1',
        customerId: 'customer-1',
        referenceId: 'payment-1',
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

    it('reports a declined card and puts the bill back to pending', async () => {
      square.createPayment.mockRejectedValue(new Error('CARD_DECLINED'));

      await expect(gateway.pay(storedPayment(), 'card-token')).rejects.toThrow(
        PaymentDeclinedError,
      );
      expect(payments.transition).toHaveBeenLastCalledWith('payment-1', PAYMENT_STATUS.PROCESSING, {
        status: PAYMENT_STATUS.PENDING,
      });
    });

    it('refuses a bill whose line items do not add up to its total', async () => {
      payments.transition.mockResolvedValueOnce(storedPayment({ total: 999 }));

      await expect(gateway.pay(storedPayment(), 'card-token')).rejects.toThrow('do not add up');
      expect(square.createPayment).not.toHaveBeenCalled();
    });

    it('refuses a bill another caller already claimed', async () => {
      payments.transition.mockResolvedValue(undefined as never);

      await expect(gateway.pay(storedPayment(), 'card-token')).rejects.toThrow(PaymentStateError);
      expect(square.createPayment).not.toHaveBeenCalled();
    });

    it('charges the bill as stored, not the copy the caller passed', async () => {
      const repriced = storedPayment({
        lineItems: [{ name: 'Repriced', quantity: 1, unitAmount: 500 }],
        discounts: [],
        total: 500,
      });
      payments.transition.mockResolvedValueOnce(repriced);

      await gateway.pay(storedPayment(), 'card-token');

      expect(square.createPayment.mock.calls[0][0].amountMoney?.amount).toBe(500n);
    });
  });

  describe('authorize and capture', () => {
    beforeEach(() => {
      payments.save.mockResolvedValue(storedPayment());
      payments.markPaid.mockResolvedValue(storedPayment({ status: PAYMENT_STATUS.PAID }));
    });

    it('holds the card, then takes the money on capture', async () => {
      const held = await gateway.authorize(NEW_PAYMENT, 'card-token');

      expect(square.createPayment.mock.calls[0][0].autocomplete).toBe(false);
      expect(held).toMatchObject({
        status: PAYMENT_STATUS.PENDING,
        squarePaymentId: 'square-payment-1',
      });

      const captured = await gateway.capture(held);

      expect(square.completePayment).toHaveBeenCalledWith('square-payment-1');
      expect(captured.status).toBe(PAYMENT_STATUS.PAID);
    });

    it('does not charge a bill for nothing', async () => {
      payments.save.mockResolvedValue(storedPayment({ status: PAYMENT_STATUS.PAID, total: 0 }));

      const held = await gateway.authorize(NEW_PAYMENT, 'card-token');

      expect(held.status).toBe(PAYMENT_STATUS.PAID);
      expect(square.createPayment).not.toHaveBeenCalled();
    });

    it('cancels the payment when the card is declined', async () => {
      square.createPayment.mockResolvedValue({ id: 'square-payment-1', status: 'FAILED' });

      await expect(gateway.authorize(NEW_PAYMENT, 'card-token')).rejects.toThrow(
        PaymentDeclinedError,
      );
      expect(payments.update).toHaveBeenCalledWith('payment-1', {
        status: PAYMENT_STATUS.CANCELED,
      });
    });

    it('voids the hold when capture fails', async () => {
      square.completePayment.mockRejectedValue(new Error('expired'));

      await expect(
        gateway.capture(storedPayment({ squarePaymentId: 'square-payment-1' })),
      ).rejects.toThrow(PaymentDeclinedError);
      expect(square.cancelPayment).toHaveBeenCalledWith('square-payment-1');
      expect(payments.update).toHaveBeenCalledWith('payment-1', {
        status: PAYMENT_STATUS.CANCELED,
      });
    });
  });

  describe('refund', () => {
    it('refunds the full amount and marks the payment refunded', async () => {
      const paid = storedPayment({
        status: PAYMENT_STATUS.PAID,
        squarePaymentId: 'square-payment-1',
      });

      expect(await gateway.refund(paid)).toBe(true);
      expect(square.refundPayment).toHaveBeenCalledWith('square-payment-1', 1080);
      expect(payments.update).toHaveBeenCalledWith(
        'payment-1',
        expect.objectContaining({ status: PAYMENT_STATUS.REFUNDED }),
      );
    });

    it('does nothing for a payment that was never paid', async () => {
      expect(await gateway.refund(storedPayment())).toBe(false);
      expect(square.refundPayment).not.toHaveBeenCalled();
      expect(payments.update).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('cancels the Square invoice of a payment made before Orion billing', async () => {
      await gateway.cancel(storedPayment({ squareInvoiceId: 'invoice-1' }));

      expect(square.cancelInvoice).toHaveBeenCalledWith('invoice-1');
      expect(payments.update).toHaveBeenCalledWith('payment-1', {
        status: PAYMENT_STATUS.CANCELED,
      });
    });
  });
});
