import type { Tone } from '$lib/frontend/components/StatusBadge.svelte';
import { SERVICE_REQUEST_STATUS, type ServiceRequestStatus } from '$lib/utils/services';

export const STATUS = SERVICE_REQUEST_STATUS;

/** Picked up and canceled requests stay off the board; the list view still shows them. */
export const BOARD_STATUSES = [STATUS.SUBMITTED, STATUS.IN_PROGRESS, STATUS.DONE] as const;
export type BoardStatus = (typeof BOARD_STATUSES)[number];

export const REQUEST_STATUS_DISPLAY: Record<ServiceRequestStatus, { label: string; tone: Tone }> = {
  submitted: { label: 'Submitted', tone: 'neutral' },
  in_progress: { label: 'In Progress', tone: 'info' },
  done: { label: 'Ready for Pickup', tone: 'success' },
  picked_up: { label: 'Picked Up', tone: 'neutral' },
  canceled: { label: 'Canceled', tone: 'danger' },
};

/** Statuses staff can set from a request's detail, including handing it over. */
export const WORK_STATUSES = [...BOARD_STATUSES, STATUS.PICKED_UP] as const;
