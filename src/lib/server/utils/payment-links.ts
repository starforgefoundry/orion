import { env } from '$env/dynamic/private';
import type { Payment } from '$lib/server/db/schema';

export const PAY_PATH = '/pay';

export function payUrl(payment: Pick<Payment, 'id'>) {
  return `${env.FRONTEND_URL}${PAY_PATH}/${payment.id}`;
}

/** Payments from before Orion billing are paid through the Square invoice link they stored. */
export function paymentLink(payment: Pick<Payment, 'id' | 'squareInvoiceId' | 'paymentUrl'>) {
  return payment.squareInvoiceId ? payment.paymentUrl : payUrl(payment);
}

export function printRequestStatusUrl(printRequestId: string) {
  return `${env.FRONTEND_URL}/print_request/status/${printRequestId}`;
}

export function printQueueUrl(printRequestId: string) {
  return `${env.FRONTEND_URL}/staff/print_requests/queue?id=${printRequestId}`;
}
