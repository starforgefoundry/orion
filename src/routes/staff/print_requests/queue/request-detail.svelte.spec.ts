import { goto } from '$app/navigation';
import { getPrintRequestById } from '$lib/remotes/endpoints/print_request.remote';
import { PAYMENT_STATUS, type PaymentStatus } from '$lib/utils/billing';
import { PRINT_REQUEST_STATUS, type PrintRequestStatus } from '$lib/utils/print_request';
import { describe, expect, it, vi } from 'vitest';
import { cancelRequest, changeStatus } from './request-actions';
import { BILLING_TYPE, RequestDetail } from './request-detail.svelte';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

vi.mock('$lib/remotes/endpoints/print_request.remote', () => ({
  getPrintRequestById: vi.fn(),
  getPrintRequestComments: vi.fn(),
  getPrintRequestDownloadUrl: vi.fn(),
  updatePrintRequestDiscount: vi.fn(),
}));

vi.mock('$lib/frontend/modal-manager.svelte', () => ({
  modalManager: { confirm: vi.fn(), show: vi.fn() },
}));

vi.mock('./request-actions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./request-actions')>()),
  cancelRequest: vi.fn(),
  changeStatus: vi.fn(),
}));

const REQUEST_ID = 'request-1';

type RequestShape = {
  status?: PrintRequestStatus;
  isQuote?: boolean;
  payment?: PaymentStatus;
};

function detailFor({
  status = PRINT_REQUEST_STATUS.IN_QUEUE,
  isQuote = false,
  payment,
}: RequestShape) {
  vi.mocked(getPrintRequestById).mockReturnValue({
    current: {
      id: REQUEST_ID,
      status,
      isQuote,
      payment: payment ? { status: payment } : null,
      files: [],
    },
  } as unknown as ReturnType<typeof getPrintRequestById>);
  const onClose = vi.fn();
  return { detail: new RequestDetail(() => REQUEST_ID, onClose), onClose };
}

describe(RequestDetail.name, () => {
  it('offers a new payment until one exists', () => {
    const { detail } = detailFor({});

    expect(detail.canCreatePayment).toBe(true);
    expect(detail.canEditPayment).toBe(false);
    expect(detail.billingType).toBe(BILLING_TYPE.PAYMENT);
  });

  it('edits an unpaid payment but not a paid or void one', () => {
    expect(detailFor({ payment: PAYMENT_STATUS.PENDING }).detail.canEditPayment).toBe(true);
    expect(detailFor({ payment: PAYMENT_STATUS.PAID }).detail.canEditPayment).toBe(false);
    expect(detailFor({ payment: PAYMENT_STATUS.CANCELED }).detail.canEditPayment).toBe(false);
  });

  it('blocks payment changes on a canceled request', () => {
    const { detail } = detailFor({ status: PRINT_REQUEST_STATUS.CANCELED });

    expect(detail.canCreatePayment).toBe(false);
    expect(detail.canCancel).toBe(false);
    expect(detail.hasFooterActions).toBe(false);
  });

  it('only cancels open, unpaid requests', () => {
    expect(detailFor({}).detail.canCancel).toBe(true);
    expect(detailFor({ status: PRINT_REQUEST_STATUS.DONE }).detail.canCancel).toBe(false);
    expect(detailFor({ payment: PAYMENT_STATUS.PAID }).detail.canCancel).toBe(false);
  });

  it('asks for a quote before one is sent', () => {
    const { detail } = detailFor({ isQuote: true });

    expect(detail.billingType).toBe(BILLING_TYPE.QUOTE);
    expect(detail.quoteNotice?.title).toBe('Quote requested');
  });

  it('waits for approval once the quote is sent', () => {
    const { detail } = detailFor({ isQuote: true, payment: PAYMENT_STATUS.QUOTE });

    expect(detail.billingType).toBe(BILLING_TYPE.QUOTE);
    expect(detail.quoteNotice?.title).toBe('Quote sent, awaiting approval');
  });

  it('treats an approved quote as a payment', () => {
    const { detail } = detailFor({ isQuote: true, payment: PAYMENT_STATUS.PENDING });

    expect(detail.billingType).toBe(BILLING_TYPE.PAYMENT);
    expect(detail.quoteNotice).toBeUndefined();
  });

  it('waits for payment before pickup', () => {
    const { detail } = detailFor({
      status: PRINT_REQUEST_STATUS.DONE,
      payment: PAYMENT_STATUS.PENDING,
    });

    expect(detail.readyForPickup).toBe(true);
    expect(detail.awaitingPayment).toBe(true);
  });

  it('closes once marked picked up', async () => {
    vi.mocked(changeStatus).mockResolvedValue(true);
    const { detail, onClose } = detailFor({ status: PRINT_REQUEST_STATUS.DONE });

    await detail.markPickedUp();

    expect(changeStatus).toHaveBeenCalledWith(
      expect.objectContaining({ id: REQUEST_ID }),
      PRINT_REQUEST_STATUS.PICKED_UP,
    );
    expect(goto).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
    expect(detail.updatingStatus).toBe(false);
  });

  it('stays open when the cancel is not confirmed', async () => {
    vi.mocked(cancelRequest).mockResolvedValue(false);
    const { detail, onClose } = detailFor({});

    await detail.cancel();

    expect(onClose).not.toHaveBeenCalled();
  });
});
