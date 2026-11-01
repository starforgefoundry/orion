import { goto } from '$app/navigation';
import { errorDescription } from '$lib/frontend/form-submit';
import { modalManager } from '$lib/frontend/modal-manager.svelte';
import {
  getPrintRequestById,
  getPrintRequestComments,
  getPrintRequestDownloadUrl,
  updatePrintRequestDiscount,
} from '$lib/remotes/endpoints/print_request.remote';
import { PAYMENT_STATUS } from '$lib/utils/billing';
import { toast } from 'svelte-sonner';
import CustomerEditModal from './CustomerEditModal.svelte';
import DiscountCodeModal from './DiscountCodeModal.svelte';
import PaymentModal from './PaymentModal.svelte';
import { QuantityEditor } from './quantity-editor.svelte';
import {
  cancelRequest,
  changeStatus,
  isAwaitingPayment,
  isClosed,
  sendPickupEmail,
  STATUS,
  unmarkPickedUp,
} from './request-actions';

export const REQUEST_DETAIL_TABS = {
  DETAILS: 'details',
  FILES: 'files',
  COMMENTS: 'comments',
} as const;
export type RequestDetailTab = (typeof REQUEST_DETAIL_TABS)[keyof typeof REQUEST_DETAIL_TABS];

export const BILLING_TYPE = { QUOTE: 'Quote', PAYMENT: 'Payment' } as const;

const SQUARE_INVOICE_URL = 'https://app.squareup.com/dashboard/invoices/';

export class RequestDetail {
  activeTab = $state<RequestDetailTab>(REQUEST_DETAIL_TABS.DETAILS);
  updatingStatus = $state(false);
  readonly quantities = new QuantityEditor();

  readonly query = $derived(getPrintRequestById(this.requestId));
  readonly comments = $derived(getPrintRequestComments(this.requestId));
  readonly downloadPath = $derived(getPrintRequestDownloadUrl(this.requestId));

  private getRequestId: () => string;
  private onClose: () => void;

  constructor(getRequestId: () => string, onClose: () => void) {
    this.getRequestId = getRequestId;
    this.onClose = onClose;
  }

  get requestId() {
    return this.getRequestId();
  }

  get request() {
    return this.query.current;
  }

  get commentCount() {
    return this.comments.current?.length ?? 0;
  }

  get downloadUrl() {
    const path = this.downloadPath.current;
    return path && new URL(path, window.location.origin).href;
  }

  get slicerUrl() {
    const url = this.downloadUrl;
    return url && `orcaslicer://open?file=${encodeURIComponent(url)}`;
  }

  get statusPageUrl() {
    return `/print_request/status/${this.requestId}`;
  }

  get squareInvoiceUrl() {
    const invoiceId = this.request?.payment?.squareInvoiceId;
    return invoiceId ? `${SQUARE_INVOICE_URL}${invoiceId}` : undefined;
  }

  get billingType() {
    const request = this.request;
    const quoteNotSent = !request?.payment || request.payment.status === PAYMENT_STATUS.QUOTE;
    return request?.isQuote && quoteNotSent ? BILLING_TYPE.QUOTE : BILLING_TYPE.PAYMENT;
  }

  get canEditPayment() {
    const request = this.request;
    return (
      !!request?.payment &&
      request.status !== STATUS.CANCELED &&
      request.payment.status !== PAYMENT_STATUS.PAID &&
      request.payment.status !== PAYMENT_STATUS.CANCELED
    );
  }

  get canCreatePayment() {
    const request = this.request;
    return !!request && !request.payment && request.status !== STATUS.CANCELED;
  }

  get canCancel() {
    const request = this.request;
    return (
      !!request &&
      !isClosed(request) &&
      request.status !== STATUS.DONE &&
      request.payment?.status !== PAYMENT_STATUS.PAID
    );
  }

  get readyForPickup() {
    return this.request?.status === STATUS.DONE;
  }

  get pickedUp() {
    return this.request?.status === STATUS.PICKED_UP;
  }

  get awaitingPayment() {
    return !!this.request && isAwaitingPayment(this.request);
  }

  get quoteNotice() {
    const request = this.request;
    if (!request?.isQuote || request.status === STATUS.CANCELED) return undefined;
    if (!request.payment) {
      return {
        title: 'Quote requested',
        description: 'Create a quote for the customer to approve before printing.',
      };
    }
    if (request.payment.status === PAYMENT_STATUS.QUOTE) {
      return {
        title: 'Quote sent, awaiting approval',
        description: 'Hold off on printing until the customer approves the quote.',
      };
    }
    return undefined;
  }

  get hasFooterActions() {
    return (
      this.canCancel ||
      this.canEditPayment ||
      this.canCreatePayment ||
      this.readyForPickup ||
      this.pickedUp
    );
  }

  close() {
    goto('?', { replaceState: true, noScroll: true, keepFocus: true });
    this.onClose();
  }

  async markPickedUp() {
    if (!this.request) return;

    this.updatingStatus = true;
    try {
      if (await changeStatus(this.request, STATUS.PICKED_UP)) this.close();
    } finally {
      this.updatingStatus = false;
    }
  }

  async unmarkPickedUp() {
    if (this.request) await unmarkPickedUp(this.request);
  }

  async cancel() {
    if (this.request && (await cancelRequest(this.request))) this.close();
  }

  async sendPickupReminder() {
    await sendPickupEmail(this.requestId);
  }

  editQuantities() {
    if (this.request) this.quantities.start(this.request.files);
  }

  async saveQuantities() {
    await this.quantities.save(this.requestId);
  }

  openPayment() {
    const request = this.request;
    if (!request) return;

    modalManager.show(PaymentModal, {
      request,
      billingType: this.billingType,
      ...(this.canEditPayment && {
        prefill: {
          buildPlates: request.buildplateCount ?? 1,
          materialCost: request.materialCost ?? 0,
        },
        isEdit: true,
      }),
    });
  }

  editCustomer() {
    const request = this.request;
    if (!request) return;

    modalManager.show(CustomerEditModal, {
      requestId: request.id,
      currentName: request.customerName,
      currentEmail: request.email,
    });
  }

  editDiscountCode() {
    const request = this.request;
    if (!request) return;

    const id = request.id;
    modalManager.show(DiscountCodeModal, {
      currentCode: request.billingCode ?? '',
      onSave: async (code: string) => {
        try {
          await updatePrintRequestDiscount({ id, billingCode: code });
          toast.success('Discount code updated', {
            description: code ? `Billing code set to "${code}".` : 'Billing code removed.',
          });
        } catch (error) {
          toast.error('Failed to update discount code', {
            description: errorDescription(error),
          });
        }
      },
    });
  }
}

export type PrintRequestDetail = NonNullable<RequestDetail['request']>;
