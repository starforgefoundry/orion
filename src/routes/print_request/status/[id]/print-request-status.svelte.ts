import { submitWithToast } from '$lib/frontend/form-submit';
import { modalManager } from '$lib/frontend/modal-manager.svelte';
import {
  getPrintRequestStatus,
  payPrintRequest,
  respondToPrintRequestQuote,
} from '$lib/remotes/endpoints/print_request.remote';
import { PRINT_REQUEST_STATUS } from '$lib/utils/print_request';
import { toast } from 'svelte-sonner';

export class PrintRequestStatusManager {
  readonly query;
  readonly request;
  readonly payment;
  readonly isCanceled;
  responding = $state(false);

  constructor(private readonly id: string) {
    this.query = getPrintRequestStatus(id);
    this.request = $derived(this.query.current);
    this.payment = $derived(this.request?.payment);
    this.isCanceled = $derived(this.request?.status === PRINT_REQUEST_STATUS.CANCELED);
  }

  async approve() {
    await this.respond(true, { success: 'Quote approved', error: 'Could not approve the quote' });
  }

  async decline() {
    const confirmed = await modalManager.confirm({
      title: 'Cancel Print Request',
      prompt: 'Are you sure you want to cancel this print request? This cannot be undone.',
      confirmText: 'Cancel Request',
      cancelText: 'Keep Request',
      variant: 'destructive',
    });
    if (!confirmed) return;

    await this.respond(false, {
      success: 'Print request canceled',
      error: 'Could not cancel the request',
    });
  }

  async pay(sourceId: string) {
    await payPrintRequest({ id: this.id, sourceId });
    toast.success('Payment received. Thank you!');
  }

  private async respond(approve: boolean, messages: { success: string; error: string }) {
    this.responding = true;
    await submitWithToast(() => respondToPrintRequestQuote({ id: this.id, approve }), messages);
    this.responding = false;
  }
}
