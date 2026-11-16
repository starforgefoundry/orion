import { cancelPayment, refundPayment, type PaymentRepositories } from '$lib/server/utils/payment';
import { PAYMENT_STATUS } from '$lib/utils/billing';
import { factory } from '$test/factory';
import { describe, expect, it, vi } from 'vitest';
import { readyPaymentNote, releasePayment, WorkOrderError } from './work-order';

vi.mock('$lib/server/utils/payment', { spy: true });

const repos = {} as PaymentRepositories;

describe(releasePayment.name, () => {
  it('refunds a paid bill', async () => {
    const payment = factory.paidPayment();
    vi.mocked(refundPayment).mockResolvedValue(true);

    await releasePayment(repos, payment);

    expect(refundPayment).toHaveBeenCalledWith(repos, payment);
    expect(cancelPayment).not.toHaveBeenCalled();
  });

  it.each([PAYMENT_STATUS.QUOTE, PAYMENT_STATUS.PENDING])('cancels a %s bill', async (status) => {
    const payment = factory.payment({ status });
    vi.mocked(cancelPayment).mockResolvedValue(payment);

    await releasePayment(repos, payment);

    expect(cancelPayment).toHaveBeenCalledWith(repos, payment);
  });

  it('refuses while a card is being charged', async () => {
    await expect(
      releasePayment(repos, factory.payment({ status: PAYMENT_STATUS.PROCESSING })),
    ).rejects.toThrow(WorkOrderError);
  });

  it.each([PAYMENT_STATUS.CANCELED, PAYMENT_STATUS.REFUNDED])(
    'leaves a %s bill alone',
    async (status) => {
      await releasePayment(repos, factory.payment({ status }));

      expect(cancelPayment).not.toHaveBeenCalled();
      expect(refundPayment).not.toHaveBeenCalled();
    },
  );
});

describe(readyPaymentNote.name, () => {
  it('asks for payment on a pending bill', () => {
    expect(readyPaymentNote(factory.payment({ status: PAYMENT_STATUS.PENDING }))).toContain(
      'Please pay',
    );
  });

  it('says an organization pays its own bills', () => {
    expect(readyPaymentNote(factory.payment({ organizationId: 'org-1' }))).toContain(
      'billed to your organization',
    );
  });
});
