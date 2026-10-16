import type { StatusDisplay } from '$lib/frontend/components/StatusIndicator.svelte';
import type { Tone } from '$lib/frontend/components/StatusBadge.svelte';
import type { PrintRequestStatus } from '$lib/remotes/dtos/print_request.dto';
import type { Payment } from '$lib/server/db/schema';
import BanIcon from '@lucide/svelte/icons/ban';
import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
import ClockIcon from '@lucide/svelte/icons/clock';
import FileTextIcon from '@lucide/svelte/icons/file-text';
import ListTodoIcon from '@lucide/svelte/icons/list-todo';
import PackageCheckIcon from '@lucide/svelte/icons/package-check';
import PackageOpenIcon from '@lucide/svelte/icons/package-open';
import Printer3dIcon from '@lucide/svelte/icons/printer-3d';

export const REQUEST_STATUS_DISPLAY: Record<PrintRequestStatus, StatusDisplay> = {
  in_queue: {
    label: 'Queued',
    tone: 'neutral',
    icon: ListTodoIcon,
  },
  printing: {
    label: 'Printing',
    tone: 'info',
    icon: Printer3dIcon,
  },
  done: {
    label: 'Ready',
    tone: 'success',
    icon: PackageOpenIcon,
  },
  picked_up: {
    label: 'Picked Up',
    tone: 'neutral',
    icon: PackageCheckIcon,
  },
  canceled: {
    label: 'Canceled',
    tone: 'danger',
    icon: BanIcon,
  },
};

export const PAYMENT_STATUS_DISPLAY: Record<Payment['status'], StatusDisplay> = {
  quote: {
    label: 'Quote Sent',
    tone: 'warning',
    icon: FileTextIcon,
  },
  pending: {
    label: 'Unpaid',
    tone: 'warning',
    icon: ClockIcon,
  },
  paid: {
    label: 'Paid',
    tone: 'success',
    icon: CircleCheckIcon,
  },
  canceled: {
    label: 'Void',
    tone: 'danger',
    icon: BanIcon,
  },
};

export function getPaymentStatusColor(status: Payment['status']): Tone {
  return PAYMENT_STATUS_DISPLAY[status].tone;
}

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
