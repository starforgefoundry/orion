import { submitWithToast } from '$lib/frontend/form-submit';
import { modalManager } from '$lib/frontend/modal-manager.svelte';
import {
  getServiceRequests,
  sendServiceReadyEmail,
  updateServiceRequestStatus,
} from '$lib/remotes/endpoints/service.remote';
import { PAYMENT_STATUS } from '$lib/utils/billing';
import type { ServiceRequestStatus } from '$lib/utils/services';
import { toast } from 'svelte-sonner';
import { STATUS } from './utils';

export type ServiceRequestRow = NonNullable<
  ReturnType<typeof getServiceRequests>['current']
>[number];

export async function changeStatus(row: ServiceRequestRow, status: ServiceRequestStatus) {
  if (status === row.request.status) return false;

  if (status === STATUS.PICKED_UP && row.payment.status !== PAYMENT_STATUS.PAID) {
    toast.error('Payment required', {
      description: 'Collect payment before marking this request picked up.',
    });
    return false;
  }

  if (status === STATUS.DONE && row.request.status !== STATUS.PICKED_UP) {
    const confirmed = await modalManager.confirm({
      title: 'Mark as Ready',
      prompt: 'Is this request done? The customer is emailed that it is ready for pickup.',
      confirmText: 'Mark Ready',
    });
    if (!confirmed) return false;
  }

  return await submitWithToast(
    () =>
      updateServiceRequestStatus({ id: row.request.id, status }).updates(
        getServiceRequests().withOverride((current) =>
          current.map((item) =>
            item.request.id === row.request.id
              ? { ...item, request: { ...item.request, status } }
              : item,
          ),
        ),
      ),
    { success: 'Request updated', error: 'Failed to update request' },
  );
}

export async function cancelRequest(row: ServiceRequestRow) {
  const confirmed = await modalManager.confirm({
    title: 'Cancel Service Request',
    prompt:
      row.payment.status === PAYMENT_STATUS.PAID
        ? 'Are you sure you want to cancel this request? The payment will be refunded and the request cannot be reopened.'
        : 'Are you sure you want to cancel this request? An unpaid bill is voided and the request cannot be reopened.',
    confirmText: 'Cancel Request',
    cancelText: 'Keep Request',
    variant: 'destructive',
  });
  if (!confirmed) return false;

  return await changeStatus(row, STATUS.CANCELED);
}

export async function sendReadyEmail(row: ServiceRequestRow) {
  return await submitWithToast(() => sendServiceReadyEmail(row.request.id), {
    success: 'Pickup reminder sent',
    error: 'Failed to send pickup reminder',
  });
}
