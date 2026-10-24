import type { Payment } from '$lib/server/db/schema';
import { PaymentStateError } from '$lib/server/repositories/payment.repository';
import { PAYMENT_STATUS, PAYMENT_TYPE } from '$lib/utils/billing';
import { factory } from '$test/factory';
import { newTestService, type ServiceMocks } from '$test/utils';
import { beforeEach, describe, expect, it } from 'vitest';
import { PaymentService } from './payment.service';

const PAYMENT_ID = 'payment-1';

function storedPayment(overrides: Partial<Payment> = {}) {
  return factory.payment({
    id: PAYMENT_ID,
    type: PAYMENT_TYPE.CAR_BAY_OVERRUN,
    total: 2000,
    ...overrides,
  });
}

describe(PaymentService.name, () => {
  let sut: PaymentService;
  let mocks: ServiceMocks;

  beforeEach(() => {
    ({ sut, mocks } = newTestService(PaymentService));
    mocks.paymentRepository.getById.mockResolvedValue(storedPayment());
    mocks.paymentRepository.pay.mockImplementation(async (payment) => ({
      ...payment,
      status: PAYMENT_STATUS.PAID,
    }));
  });

  it('charges the card for an unpaid bill', async () => {
    const paid = await sut.pay({ id: PAYMENT_ID, sourceId: 'card-token' });

    expect(paid.status).toBe(PAYMENT_STATUS.PAID);
  });

  it('lets an organization pay its balance', async () => {
    mocks.paymentRepository.getById.mockResolvedValue(
      storedPayment({ type: PAYMENT_TYPE.BALANCE, organizationId: 'org-1' }),
    );

    expect((await sut.getCheckout(PAYMENT_ID))?.payable).toBe(true);
    await expect(sut.pay({ id: PAYMENT_ID, sourceId: 'card-token' })).resolves.toBeDefined();
  });

  it.each<[string, Partial<Payment>]>([
    [
      'a print billed to an organization',
      { type: PAYMENT_TYPE.PRINT_REQUEST, organizationId: 'org-1' },
    ],
    ['an organization charge', { type: PAYMENT_TYPE.ORG_CHARGE, organizationId: 'org-1' }],
    ['a Square invoice', { squareInvoiceId: 'invoice-1' }],
    ['a paid bill', { status: PAYMENT_STATUS.PAID }],
  ])('refuses to take a card for %s', async (_, overrides) => {
    mocks.paymentRepository.getById.mockResolvedValue(storedPayment(overrides));

    expect((await sut.getCheckout(PAYMENT_ID))?.payable).toBe(false);
    await expect(sut.pay({ id: PAYMENT_ID, sourceId: 'card-token' })).rejects.toThrow(
      PaymentStateError,
    );
    expect(mocks.paymentRepository.pay).not.toHaveBeenCalled();
  });
});
