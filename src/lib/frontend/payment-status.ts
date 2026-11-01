import type { StatusDisplay } from '$lib/frontend/components/StatusIndicator.svelte';
import type { Tone } from '$lib/frontend/components/StatusBadge.svelte';
import type { PaymentStatus } from '$lib/utils/billing';
import BanIcon from '@lucide/svelte/icons/ban';
import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
import ClockIcon from '@lucide/svelte/icons/clock';
import FileTextIcon from '@lucide/svelte/icons/file-text';
import Undo2Icon from '@lucide/svelte/icons/undo-2';

export const PAYMENT_STATUS_DISPLAY: Record<PaymentStatus, StatusDisplay> = {
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
  processing: {
    label: 'Processing',
    tone: 'info',
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
  refunded: {
    label: 'Refunded',
    tone: 'neutral',
    icon: Undo2Icon,
  },
};

export function getPaymentStatusColor(status: PaymentStatus): Tone {
  return PAYMENT_STATUS_DISPLAY[status].tone;
}
