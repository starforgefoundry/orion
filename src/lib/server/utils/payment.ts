import type { EnumValue } from '$lib/utils/enum';
import type { Payment } from '$lib/server/db/schema';
import {
  PaymentError,
  PaymentStateError,
  type NewPayment,
  type PaymentRepository,
} from '$lib/server/repositories/payment.repository';
import type { SettingsRepository } from '$lib/server/repositories/settings.repository';
import type { SquareRepository } from '$lib/server/repositories/square.repository';
import { SQUARE_CURRENCY, SQUARE_PAYMENT_STATUS, squareOrderLines } from '$lib/server/utils/square';
import { lineItemsTotal, PAYMENT_STATUS } from '$lib/utils/billing';
import { DateTime } from 'luxon';

export class PaymentDeclinedError extends PaymentError {
  constructor(options?: ErrorOptions) {
    super('Payment failed. Please check your card details and try again.', options);
  }
}

/** A hold leaves the money on the card until `capture`; a charge takes it straight away. */
const PAYMENT_CHANGED_MESSAGE = 'This payment changed while it was being canceled. Try again.';

const CHARGE_MODE = {
  HOLD: { autocomplete: false, expectedStatus: SQUARE_PAYMENT_STATUS.APPROVED },
  CHARGE: { autocomplete: true, expectedStatus: SQUARE_PAYMENT_STATUS.COMPLETED },
} as const;

type ChargeMode = EnumValue<typeof CHARGE_MODE>;

function discountTotal(payment: Pick<Payment, 'discounts'>) {
  return payment.discounts.reduce((total, discount) => total + discount.amount, 0);
}

export type PaymentRepositories = {
  paymentRepository: PaymentRepository;
  squareRepository: SquareRepository;
  settingsRepository: SettingsRepository;
};

/**
 * Cancels an unpaid bill, and any Square invoice a pre-Orion payment was sent as. Only cancels
 * from the status the caller read, so a checkout that started charging since then wins.
 */
export async function cancelPayment(repos: PaymentRepositories, payment: Payment) {
  if (payment.status === PAYMENT_STATUS.CANCELED) return payment;
  const canceled = await repos.paymentRepository.transition(payment.id, payment.status, {
    status: PAYMENT_STATUS.CANCELED,
  });
  if (!canceled) throw new PaymentStateError(PAYMENT_CHANGED_MESSAGE);
  if (payment.squareInvoiceId) {
    await repos.squareRepository.cancelInvoice(payment.squareInvoiceId);
  }
  return canceled;
}

/**
 * Holds the amount on the card without taking it, so a booking that falls through can be
 * voided instead of refunded. The payment stays pending until `capturePayment`.
 */
export async function authorizePayment(
  repos: PaymentRepositories,
  payment: NewPayment,
  sourceId: string,
) {
  const created = await repos.paymentRepository.save({
    ...payment,
    status: PAYMENT_STATUS.PENDING,
  });
  if (created.status === PAYMENT_STATUS.PAID) return created;

  const ids = await chargeCard(repos, created, sourceId, CHARGE_MODE.HOLD).catch(async (error) => {
    await repos.paymentRepository.update(created.id, { status: PAYMENT_STATUS.CANCELED });
    throw error;
  });
  return await repos.paymentRepository.update(created.id, ids);
}

export async function capturePayment(repos: PaymentRepositories, payment: Payment) {
  if (!payment.squarePaymentId) return payment;
  try {
    await repos.squareRepository.completePayment(payment.squarePaymentId);
  } catch (error) {
    await voidPayment(repos, payment);
    throw new PaymentDeclinedError({ cause: error });
  }
  return (await repos.paymentRepository.markPaid(payment.id)) ?? payment;
}

export async function voidPayment(repos: PaymentRepositories, payment: Payment) {
  if (payment.squarePaymentId) {
    await repos.squareRepository.cancelPayment(payment.squarePaymentId);
  }
  return await repos.paymentRepository.update(payment.id, { status: PAYMENT_STATUS.CANCELED });
}

/** Charges the card for a payment the customer was asked to pay. */
export async function chargePayment(
  repos: PaymentRepositories,
  payment: Payment,
  sourceId: string,
) {
  const claimed = await repos.paymentRepository.transition(payment.id, PAYMENT_STATUS.PENDING, {
    status: PAYMENT_STATUS.PROCESSING,
  });
  if (!claimed) throw new PaymentStateError('This payment is not waiting to be paid');

  let ids: Awaited<ReturnType<typeof chargeCard>>;
  try {
    ids = await chargeCard(repos, claimed, sourceId, CHARGE_MODE.CHARGE);
  } catch (error) {
    await repos.paymentRepository.transition(claimed.id, PAYMENT_STATUS.PROCESSING, {
      status: PAYMENT_STATUS.PENDING,
    });
    throw error;
  }

  return await repos.paymentRepository.transition(claimed.id, PAYMENT_STATUS.PROCESSING, {
    ...ids,
    status: PAYMENT_STATUS.PAID,
    paymentDate: DateTime.now(),
  });
}

/** The Square payment that took the money, including one made by paying a pre-Orion invoice. */
async function squarePaymentIdFor(repos: PaymentRepositories, payment: Payment) {
  if (payment.squarePaymentId || !payment.squareInvoiceId) return payment.squarePaymentId;
  const paymentId = await repos.squareRepository.getInvoicePaymentId(payment.squareInvoiceId);
  if (!paymentId) {
    throw new PaymentStateError(
      'Could not find the Square payment for this invoice. Refund it in Square instead.',
    );
  }
  return paymentId;
}

/**
 * Marks the payment refunded before refunding in Square, so two cancels cannot both refund it.
 * A refund Square refuses puts the payment back to paid.
 */
export async function refundPayment(repos: PaymentRepositories, payment: Payment) {
  if (payment.status !== PAYMENT_STATUS.PAID) return false;
  const squarePaymentId = payment.total > 0 ? await squarePaymentIdFor(repos, payment) : null;

  const claimed = await repos.paymentRepository.transition(payment.id, PAYMENT_STATUS.PAID, {
    status: PAYMENT_STATUS.REFUNDED,
    refundedDate: DateTime.now(),
  });
  if (!claimed) return false;

  if (squarePaymentId) {
    try {
      await repos.squareRepository.refundPayment(squarePaymentId, payment.total);
    } catch (error) {
      await repos.paymentRepository.transition(payment.id, PAYMENT_STATUS.REFUNDED, {
        status: PAYMENT_STATUS.PAID,
        refundedDate: null,
      });
      throw error;
    }
  }
  return true;
}

async function chargeCard(
  repos: PaymentRepositories,
  payment: Payment,
  sourceId: string,
  mode: ChargeMode,
) {
  const charged = lineItemsTotal(payment.lineItems) - discountTotal(payment);
  if (charged !== payment.total) {
    throw new Error(`Payment ${payment.id} line items do not add up to its total`);
  }

  const { locationId } = await repos.settingsRepository.getSetting('printRequestSquare');
  const customer = await repos.squareRepository.upsertCustomer(
    payment.customerName,
    payment.customerEmail,
  );
  const order = await repos.squareRepository.createOrder({
    idempotencyKey: crypto.randomUUID(),
    order: {
      locationId,
      customerId: customer.id,
      referenceId: payment.id,
      ...squareOrderLines(payment.lineItems, payment.discounts),
    },
  });
  if (!order?.id) throw new Error('Failed to create order in Square');

  const squarePayment = await repos.squareRepository
    .createPayment({
      sourceId,
      idempotencyKey: crypto.randomUUID(),
      amountMoney: { amount: BigInt(payment.total), currency: SQUARE_CURRENCY },
      orderId: order.id,
      locationId,
      customerId: customer.id,
      buyerEmailAddress: payment.customerEmail || undefined,
      autocomplete: mode.autocomplete,
    })
    .catch((error) => {
      throw new PaymentDeclinedError({ cause: error });
    });
  if (!squarePayment?.id || squarePayment.status !== mode.expectedStatus) {
    throw new PaymentDeclinedError();
  }

  return { squareOrderId: order.id, squarePaymentId: squarePayment.id };
}
