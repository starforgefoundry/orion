import { PaymentStateError } from '$lib/server/repositories/payment.repository';
import { PAYMENT_STATUS, PAYMENT_TYPE } from '$lib/utils/billing';
import { DateTime } from 'luxon';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentService } from './payment.service';

vi.mock('$env/dynamic/private', () => ({ env: {} }));

function storedPayment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'payment-1',
    type: PAYMENT_TYPE.CAR_BAY_OVERRUN,
    status: PAYMENT_STATUS.PENDING,
    customerName: 'Jane Doe',
    issuedDate: DateTime.now(),
    paymentDate: null,
    lineItems: [],
    discounts: [],
    total: 2000,
    organizationId: null,
    squareInvoiceId: null,
    paymentUrl: null,
    ...overrides,
  };
}

describe('PaymentService', () => {
  let service: PaymentService;
  let paymentRepo: any;

  beforeEach(() => {
    paymentRepo = {
      getById: vi.fn(async () => storedPayment()),
      pay: vi.fn(async (payment) => ({ ...payment, status: PAYMENT_STATUS.PAID })),
    };
    service = new PaymentService(undefined, undefined, undefined, paymentRepo);
  });

  it('charges the card for an unpaid bill', async () => {
    const paid = await service.pay({ id: 'payment-1', sourceId: 'card-token' });

    expect(paid.status).toBe(PAYMENT_STATUS.PAID);
  });

  it('lets an organization pay its balance', async () => {
    paymentRepo.getById.mockResolvedValue(
      storedPayment({ type: PAYMENT_TYPE.BALANCE, organizationId: 'org-1' }),
    );

    expect((await service.getCheckout('payment-1'))?.payable).toBe(true);
    await expect(service.pay({ id: 'payment-1', sourceId: 'card-token' })).resolves.toBeDefined();
  });

  it.each([
    [
      'a print billed to an organization',
      { type: PAYMENT_TYPE.PRINT_REQUEST, organizationId: 'org-1' },
    ],
    ['an organization charge', { type: PAYMENT_TYPE.ORG_CHARGE, organizationId: 'org-1' }],
    ['a Square invoice', { squareInvoiceId: 'invoice-1' }],
    ['a paid bill', { status: PAYMENT_STATUS.PAID }],
  ])('refuses to take a card for %s', async (_, overrides) => {
    paymentRepo.getById.mockResolvedValue(storedPayment(overrides));

    expect((await service.getCheckout('payment-1'))?.payable).toBe(false);
    await expect(service.pay({ id: 'payment-1', sourceId: 'card-token' })).rejects.toThrow(
      PaymentStateError,
    );
    expect(paymentRepo.pay).not.toHaveBeenCalled();
  });
});
