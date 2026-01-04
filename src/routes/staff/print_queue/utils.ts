import type { Color } from '@immich/ui';

export function getStatusColor(status: string): Color {
  switch (status) {
    case 'in_queue':
      return 'secondary';
    case 'printing':
      return 'info';
    case 'done':
      return 'success';
    case 'picked_up':
      return 'success';
    case 'canceled':
      return 'danger';
    default:
      return 'secondary';
  }
}

export function getPaymentStatusColor(status: string): Color {
  switch (status) {
    case 'quote':
      return 'secondary';
    case 'pending':
      return 'info';
    case 'paid':
      return 'success';
    case 'canceled':
      return 'danger';
    default:
      return 'secondary';
  }
}
