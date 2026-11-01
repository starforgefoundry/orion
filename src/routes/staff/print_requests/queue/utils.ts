import type { StatusDisplay } from '$lib/frontend/components/StatusIndicator.svelte';
import type { PrintRequestStatus } from '$lib/utils/print_request';
import BanIcon from '@lucide/svelte/icons/ban';
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
