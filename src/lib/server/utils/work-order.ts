import { UserError } from '$lib/errors';
import type { Payment } from '$lib/server/db/schema';
import { sendTemplate, type EmailRepositories } from '$lib/server/utils/email';
import type { EmailSender } from '$lib/server/utils/email-templates/senders';
import { cancelPayment, refundPayment, type PaymentRepositories } from '$lib/server/utils/payment';
import {
  canReleasePayment,
  canSendPaymentReminder,
  centsToDollars,
  PAYMENT_STATUS,
} from '$lib/utils/billing';

/** Who a print or service request is for, and where its emails link to. */
export type WorkOrder = {
  email: string;
  customerName: string;
  itemName: string;
  sender: EmailSender;
  /** Where the customer sees the request and pays for it. */
  link: string;
};

export class WorkOrderError extends UserError {}

/** Refunds the bill of a canceled request, or cancels it when it was never paid. */
export async function releasePayment(repos: PaymentRepositories, payment: Payment) {
  if (!canReleasePayment(payment)) {
    if (payment.status === PAYMENT_STATUS.PROCESSING) {
      throw new WorkOrderError('A card is being charged for this request. Try again in a moment.');
    }
    return;
  }
  if (payment.status === PAYMENT_STATUS.PAID) {
    await refundPayment(repos, payment);
  } else {
    await cancelPayment(repos, payment);
  }
}

export async function sendPaymentReminder(
  repos: EmailRepositories,
  order: WorkOrder,
  payment: Payment,
) {
  if (!canSendPaymentReminder(payment)) {
    throw new WorkOrderError('This request has nothing to pay.');
  }

  await sendTemplate(repos, order.email, order.sender, 'payment_reminder', {
    customerName: order.customerName,
    itemName: order.itemName,
    total: centsToDollars(payment.total),
    paymentUrl: order.link,
  });
}

/** Tells the customer whether they still owe anything when their request is ready. */
export function readyPaymentNote(payment: Payment | null) {
  if (payment?.organizationId) {
    return 'This is billed to your organization, so there is nothing for you to pay. You can check on it here:';
  }
  if (payment?.status === PAYMENT_STATUS.PENDING) {
    return 'Please pay before you pick it up. You can see the cost breakdown and pay here:';
  }
  return 'You can see your request and its cost breakdown here:';
}
