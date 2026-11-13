import type { Tone } from '$lib/frontend/components/StatusBadge.svelte';
import { PAYMENT_STATUS, type PaymentStatus } from '$lib/utils/billing';
import {
  awaitingQuote,
  SERVICE_PRICING,
  SERVICE_REQUEST_STATUS,
  type ServicePricing,
  type ServiceRequestStatus,
} from '$lib/utils/services';

export const STATUS = SERVICE_REQUEST_STATUS;

/** Canceled requests stay off the board; the list view still shows them. */
export const BOARD_STATUSES = [STATUS.SUBMITTED, STATUS.IN_PROGRESS, STATUS.DONE] as const;
export type BoardStatus = (typeof BOARD_STATUSES)[number];

export const REQUEST_STATUS_DISPLAY: Record<ServiceRequestStatus, { label: string; tone: Tone }> = {
  submitted: { label: 'Submitted', tone: 'neutral' },
  in_progress: { label: 'In Progress', tone: 'info' },
  done: { label: 'Done', tone: 'success' },
  canceled: { label: 'Canceled', tone: 'danger' },
};

type PaymentSummary = { status: PaymentStatus; lineItems: unknown[] };

/** Work starts only once a quote is sent, which the server enforces too. */
export function quoteRequired(payment: PaymentSummary, status: ServiceRequestStatus) {
  return (status === STATUS.IN_PROGRESS || status === STATUS.DONE) && awaitingQuote(payment);
}

/** Variable prices can be re-quoted until the customer pays. */
export function canQuote(pricingMode: ServicePricing, payment: PaymentSummary) {
  return (
    pricingMode === SERVICE_PRICING.VARIABLE &&
    (payment.status === PAYMENT_STATUS.QUOTE || payment.status === PAYMENT_STATUS.PENDING)
  );
}
