import type { PrintRequestStatus } from '$lib/remotes/dtos/print_request.dto';

export const PRINT_REQUEST_STATUS = {
  IN_QUEUE: 'in_queue',
  PRINTING: 'printing',
  DONE: 'done',
  PICKED_UP: 'picked_up',
  CANCELED: 'canceled',
} as const satisfies Record<string, PrintRequestStatus>;
