import { getServiceRequests } from '$lib/remotes/endpoints/service.remote';
import { PAYMENT_STATUS, type PaymentStatus } from '$lib/utils/billing';
import { SERVICE_PRICING, type ServiceRequestStatus } from '$lib/utils/services';
import { describe, expect, it, vi } from 'vitest';
import { ServiceRequestDetail } from './request-detail.svelte';
import { STATUS } from './utils';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

vi.mock('$lib/remotes/endpoints/service.remote', () => ({
  getServiceRequests: vi.fn(),
  priceServiceRequest: vi.fn(),
  updateServiceRequestStatus: vi.fn(),
}));

vi.mock('$lib/frontend/modal-manager.svelte', () => ({
  modalManager: { confirm: vi.fn(), show: vi.fn() },
}));

const REQUEST_ID = 'request-1';
const TOTAL = 2500;

type RowShape = { status?: ServiceRequestStatus; payment?: PaymentStatus; quoted?: boolean };

function detailFor({
  status = STATUS.SUBMITTED,
  payment = PAYMENT_STATUS.QUOTE,
  quoted,
}: RowShape) {
  vi.mocked(getServiceRequests).mockReturnValue({
    current: [
      {
        request: { id: REQUEST_ID, status },
        pricingMode: SERVICE_PRICING.VARIABLE,
        payment: { id: 'payment-1', status: payment, total: TOTAL, lineItems: quoted ? [{}] : [] },
      },
    ],
  } as unknown as ReturnType<typeof getServiceRequests>);
  return new ServiceRequestDetail(() => REQUEST_ID, vi.fn());
}

describe(ServiceRequestDetail.name, () => {
  it('keeps an unquoted request in submitted and starts the quote empty', () => {
    const detail = detailFor({});

    expect(detail.statusOptions.map((option) => option.value)).toEqual([STATUS.SUBMITTED]);
    expect(detail.quote).toBe(0);
    expect(detail.quoteLabel).toBe('Save Quote');
    expect(detail.payUrl).toBeUndefined();
  });

  it('prefills the current price once quoted', () => {
    const detail = detailFor({ payment: PAYMENT_STATUS.PENDING, quoted: true });

    expect(detail.quote).toBe(TOTAL);
    expect(detail.quoteLabel).toBe('Update Quote');
    expect(detail.payUrl).toBe('/pay/payment-1');
    expect(detail.statusOptions).toHaveLength(3);
  });

  it.each([PAYMENT_STATUS.PROCESSING, PAYMENT_STATUS.PAID])(
    'stops quoting and canceling once the payment is %s',
    (payment) => {
      const detail = detailFor({ payment, quoted: true });

      expect(detail.canQuote).toBe(false);
      expect(detail.canCancel).toBe(false);
    },
  );

  it('freezes a canceled request', () => {
    const detail = detailFor({ status: STATUS.CANCELED, payment: PAYMENT_STATUS.CANCELED });

    expect(detail.canChangeStatus).toBe(false);
    expect(detail.canCancel).toBe(false);
    expect(detail.canQuote).toBe(false);
  });
});
