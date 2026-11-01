import { PaymentDeclinedError, PaymentGateway } from '$lib/server/gateways/payment.gateway';
import type { NewPayment } from '$lib/server/repositories/payment.repository';
import { PAYMENT_STATUS, PAYMENT_TYPE } from '$lib/utils/billing';
import { factory } from '$test/factory';
import { automock } from '$test/utils';
import { beforeEach, describe, expect, it, vi, type Mocked } from 'vitest';
import { bookWithPayment, type PaidBookingSteps } from './paid_booking';

const SOURCE_ID = 'card-token';
const NEW_PAYMENT: NewPayment = {
  type: PAYMENT_TYPE.CLASS_BOOKING,
  status: PAYMENT_STATUS.PENDING,
  customer: { name: 'Ada', email: 'ada@example.com' },
  bill: { lineItems: [], discounts: [], total: 0 },
};

describe(bookWithPayment.name, () => {
  const authorized = factory.payment({ status: PAYMENT_STATUS.PENDING });
  const captured = factory.payment({ ...authorized, status: PAYMENT_STATUS.PAID });
  const booking = { id: 'booking-1' };

  let payments: Mocked<PaymentGateway>;
  let steps: Mocked<PaidBookingSteps<typeof booking>>;

  beforeEach(() => {
    payments = automock(PaymentGateway);
    payments.authorize.mockResolvedValue(authorized);
    payments.capture.mockResolvedValue(captured);
    payments.void.mockResolvedValue(authorized);
    steps = { create: vi.fn().mockResolvedValue(booking), cancel: vi.fn() };
  });

  it('creates the booking against the hold, then takes the money', async () => {
    const result = await bookWithPayment(payments, NEW_PAYMENT, SOURCE_ID, steps);

    expect(payments.authorize).toHaveBeenCalledWith(NEW_PAYMENT, SOURCE_ID);
    expect(steps.create).toHaveBeenCalledWith(authorized);
    expect(payments.capture).toHaveBeenCalledWith(authorized);
    expect(result).toEqual({ booking, payment: captured });
  });

  it('creates nothing when the card is declined', async () => {
    payments.authorize.mockRejectedValue(new PaymentDeclinedError());

    await expect(bookWithPayment(payments, NEW_PAYMENT, SOURCE_ID, steps)).rejects.toThrow(
      PaymentDeclinedError,
    );
    expect(steps.create).not.toHaveBeenCalled();
  });

  it('releases the hold when the booking cannot be created', async () => {
    const failure = new Error('slot taken');
    steps.create.mockRejectedValue(failure);

    await expect(bookWithPayment(payments, NEW_PAYMENT, SOURCE_ID, steps)).rejects.toBe(failure);
    expect(payments.void).toHaveBeenCalledWith(authorized);
    expect(payments.capture).not.toHaveBeenCalled();
  });

  it('cancels the booking when the money cannot be taken', async () => {
    payments.capture.mockRejectedValue(new PaymentDeclinedError());

    await expect(bookWithPayment(payments, NEW_PAYMENT, SOURCE_ID, steps)).rejects.toThrow(
      PaymentDeclinedError,
    );
    expect(steps.cancel).toHaveBeenCalledWith(booking);
    expect(payments.void).not.toHaveBeenCalled();
  });
});
