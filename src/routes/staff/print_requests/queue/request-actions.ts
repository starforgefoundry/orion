import { modalManager } from '$lib/frontend/modal-manager.svelte';
import type { PrintRequestDto, PrintRequestStatus } from '$lib/remotes/dtos/print_request.dto';
import {
  getPrintRequestById,
  getPrintRequests,
  sendPickupNotification,
  updatePrintRequestStatus,
} from '$lib/remotes/endpoints/print_request.remote';
import { PRINT_REQUEST_STATUS } from '$lib/utils/print_request';
import { toast } from 'svelte-sonner';

export const STATUS = PRINT_REQUEST_STATUS;

export const BOARD_STATUSES = [STATUS.IN_QUEUE, STATUS.PRINTING, STATUS.DONE] as const;

export const STATUS_LABELS: Record<PrintRequestStatus, string> = {
  in_queue: 'Print Queue',
  printing: 'Printing',
  done: 'Ready for Pickup',
  picked_up: 'Picked Up',
  canceled: 'Canceled',
};

type RequestSummary = Pick<PrintRequestDto, 'id' | 'status' | 'payment'>;

export function isAwaitingPayment(request: RequestSummary) {
  return !!request.payment && request.payment.status !== 'paid';
}

export function isClosed(request: RequestSummary) {
  return request.status === STATUS.CANCELED || request.status === STATUS.PICKED_UP;
}

export async function changeStatus(request: RequestSummary, status: PrintRequestStatus) {
  if (status === request.status) return false;

  if (status === STATUS.PICKED_UP && isAwaitingPayment(request)) {
    toast.error('Payment required', {
      description: 'Mark the payment as paid before marking this request picked up.',
    });
    return false;
  }

  if (status === STATUS.DONE) {
    const confirmed = await modalManager.confirm({
      title: 'Mark as Ready',
      prompt: 'Is this print complete and ready for pickup?',
      confirmText: 'Mark Ready',
    });
    if (!confirmed) return false;
  }

  try {
    await updatePrintRequestStatus({ id: request.id, status }).updates(
      getPrintRequests().withOverride((current) =>
        current.map((item) => (item.id === request.id ? { ...item, status } : item)),
      ),
      getPrintRequestById(request.id),
    );
    return true;
  } catch {
    toast.error('Failed to update print request status.');
    return false;
  }
}

export async function cancelRequest(request: RequestSummary) {
  const confirmed = await modalManager.confirm({
    title: 'Cancel Print Request',
    prompt: 'Are you sure you want to cancel this print request? This action cannot be undone.',
    confirmText: 'Cancel Request',
    cancelText: 'Keep Request',
    variant: 'destructive',
  });

  if (!confirmed) return false;

  try {
    await updatePrintRequestStatus({ id: request.id, status: STATUS.CANCELED }).updates(
      getPrintRequestById(request.id),
    );
    return true;
  } catch {
    toast.error('Failed to cancel print request.');
    return false;
  }
}

export async function sendPickupEmail(requestId: string) {
  try {
    await sendPickupNotification(requestId);
    toast.success('Pickup notification sent');
  } catch {
    toast.error('Failed to send pickup notification.');
  }
}
