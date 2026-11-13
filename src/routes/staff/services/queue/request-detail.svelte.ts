import { goto } from '$app/navigation';
import { submitWithToast } from '$lib/frontend/form-submit';
import { getServiceRequests, priceServiceRequest } from '$lib/remotes/endpoints/service.remote';
import {
  awaitingQuote,
  canQuote,
  isCancelable,
  quoteRequired,
  type ServiceRequestStatus,
} from '$lib/utils/services';
import { toast } from 'svelte-sonner';
import { cancelRequest, changeStatus } from './request-actions';
import { BOARD_STATUSES, REQUEST_STATUS_DISPLAY, STATUS } from './utils';

export class ServiceRequestDetail {
  /** Typed quote in cents; until staff type one the field shows the current price. */
  quoteDraft = $state<number>();
  savingQuote = $state(false);

  // The staff list already holds every request, so the modal reads its row from there.
  readonly query = getServiceRequests();

  private getRequestId: () => string;
  private onClose: () => void;

  constructor(getRequestId: () => string, onClose: () => void) {
    this.getRequestId = getRequestId;
    this.onClose = onClose;
  }

  get requestId() {
    return this.getRequestId();
  }

  get row() {
    return this.query.current?.find(({ request }) => request.id === this.requestId);
  }

  get awaitingQuote() {
    return !!this.row && awaitingQuote(this.row.payment);
  }

  get canQuote() {
    return (
      !!this.row &&
      this.row.request.status !== STATUS.CANCELED &&
      canQuote(this.row.pricingMode, this.row.payment)
    );
  }

  get quote() {
    return this.quoteDraft ?? (this.awaitingQuote ? 0 : (this.row?.payment.total ?? 0));
  }

  set quote(cents: number) {
    this.quoteDraft = cents;
  }

  get quoteLabel() {
    return this.awaitingQuote ? 'Save Quote' : 'Update Quote';
  }

  get payUrl() {
    const payment = this.row?.payment;
    if (!payment || awaitingQuote(payment)) return undefined;
    return `/pay/${payment.id}`;
  }

  get statusOptions() {
    const row = this.row;
    return BOARD_STATUSES.filter((status) => !row || !quoteRequired(row.payment, status)).map(
      (status) => ({ value: status, label: REQUEST_STATUS_DISPLAY[status].label }),
    );
  }

  get canChangeStatus() {
    return !!this.row && this.row.request.status !== STATUS.CANCELED;
  }

  /** The server only cancels unpaid requests, so the button follows the same rule. */
  get canCancel() {
    return this.canChangeStatus && !!this.row && isCancelable(this.row.payment);
  }

  close() {
    goto('?', { replaceState: true, noScroll: true, keepFocus: true });
    this.onClose();
  }

  async saveQuote() {
    if (!this.row || !(this.quote > 0)) return;
    this.savingQuote = true;
    const saved = await submitWithToast(
      () => priceServiceRequest({ id: this.requestId, price: this.quote }),
      { success: 'Quote saved', error: 'Failed to save quote' },
    );
    this.savingQuote = false;
    if (saved) this.quoteDraft = undefined;
  }

  async changeStatus(status: ServiceRequestStatus) {
    if (this.row) await changeStatus(this.row, status);
  }

  async cancel() {
    if (this.row && (await cancelRequest(this.row))) this.close();
  }

  async copyPayUrl() {
    if (!this.payUrl) return;
    await navigator.clipboard.writeText(new URL(this.payUrl, window.location.origin).href);
    toast.success('Payment link copied');
  }
}
