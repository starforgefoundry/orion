import type { NewPayment } from '$lib/server/repositories/payment.repository';
import {
  authorizePayment,
  capturePayment,
  PaymentDeclinedError,
  voidPayment,
  type PaymentRepositories,
} from '$lib/server/utils/payment';
import { PAYMENT_STATUS, PAYMENT_TYPE } from '$lib/utils/billing';
import { factory } from '$test/factory';
import { beforeEach, describe, expect, it, vi, type Mocked } from 'vitest';
import { bookWithPayment, type PaidBookingSteps } from './paid-booking';

vi.mock('$lib/server/utils/payment', { spy: true });

const SOURCE_ID = 'card-token';
const NEW_PAYMENT: NewPayment = {
  type: PAYMENT_TYPE.CLASS_BOOKING,
  status: PAYMENT_STATUS.PENDING,
  customer: { name: 'Ada', email: 'ada@example.com' },
  bill: { lineItems: [], discounts: [], total: 0 },
};

describe(bookWithPayment.name, () => {
  const repos = {} as PaymentRepositories;
  const authorized = factory.payment({ status: PAYMENT_STATUS.PENDING });
  const captured = factory.payment({ ...authorized, status: PAYMENT_STATUS.PAID });
  const booking = { id: 'booking-1' };

  let steps: Mocked<PaidBookingSteps<typeof booking>>;

  beforeEach(() => {
    vi.mocked(authorizePayment).mockResolvedValue(authorized);
    vi.mocked(capturePayment).mockResolvedValue(captured);
    vi.mocked(voidPayment).mockResolvedValue(authorized);
    steps = { create: vi.fn().mockResolvedValue(booking), cancel: vi.fn() };
  });

  it('creates the booking against the hold, then takes the money', async () => {
    const result = await bookWithPayment(repos, NEW_PAYMENT, SOURCE_ID, steps);

    expect(authorizePayment).toHaveBeenCalledWith(repos, NEW_PAYMENT, SOURCE_ID);
    expect(steps.create).toHaveBeenCalledWith(authorized);
    expect(capturePayment).toHaveBeenCalledWith(repos, authorized);
    expect(result).toEqual({ booking, payment: captured });
  });

  it('creates nothing when the card is declined', async () => {
    vi.mocked(authorizePayment).mockRejectedValue(new PaymentDeclinedError());

    await expect(bookWithPayment(repos, NEW_PAYMENT, SOURCE_ID, steps)).rejects.toThrow(
      PaymentDeclinedError,
    );
    expect(steps.create).not.toHaveBeenCalled();
  });

  it('releases the hold when the booking cannot be created', async () => {
    const failure = new Error('slot taken');
    steps.create.mockRejectedValue(failure);

    await expect(bookWithPayment(repos, NEW_PAYMENT, SOURCE_ID, steps)).rejects.toBe(failure);
    expect(voidPayment).toHaveBeenCalledWith(repos, authorized);
    expect(capturePayment).not.toHaveBeenCalled();
  });

  it('cancels the booking when the money cannot be taken', async () => {
    vi.mocked(capturePayment).mockRejectedValue(new PaymentDeclinedError());

    await expect(bookWithPayment(repos, NEW_PAYMENT, SOURCE_ID, steps)).rejects.toThrow(
      PaymentDeclinedError,
    );
    expect(steps.cancel).toHaveBeenCalledWith(booking);
    expect(voidPayment).not.toHaveBeenCalled();
  });
});
