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
const CHARGE_MODE = {
  HOLD: { autocomplete: false, expectedStatus: SQUARE_PAYMENT_STATUS.APPROVED },
  CHARGE: { autocomplete: true, expectedStatus: SQUARE_PAYMENT_STATUS.COMPLETED },
} as const;

type ChargeMode = (typeof CHARGE_MODE)[keyof typeof CHARGE_MODE];

function discountTotal(payment: Pick<Payment, 'discounts'>) {
  return payment.discounts.reduce((total, discount) => total + discount.amount, 0);
}

/** Moves stored payments through their states while charging, holding and refunding in Square. */
export class PaymentGateway {
  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly squareRepository: SquareRepository,
    private readonly settingsRepository: SettingsRepository,
  ) {}

  /** Cancels any Square invoice a pre-Orion payment was sent as. */
  async cancel(payment: Payment) {
    if (payment.status === PAYMENT_STATUS.CANCELED) return payment;
    if (payment.squareInvoiceId && payment.status !== PAYMENT_STATUS.PAID) {
      await this.squareRepository.cancelInvoice(payment.squareInvoiceId);
    }
    return await this.paymentRepository.update(payment.id, { status: PAYMENT_STATUS.CANCELED });
  }

  /**
   * Holds the amount on the card without taking it, so a booking that falls through can be
   * voided instead of refunded. The payment stays pending until `capture`.
   */
  async authorize(payment: NewPayment, sourceId: string) {
    const created = await this.paymentRepository.save({
      ...payment,
      status: PAYMENT_STATUS.PENDING,
    });
    if (created.status === PAYMENT_STATUS.PAID) return created;

    const ids = await this.chargeCard(created, sourceId, CHARGE_MODE.HOLD).catch(async (error) => {
      await this.paymentRepository.update(created.id, { status: PAYMENT_STATUS.CANCELED });
      throw error;
    });
    return await this.paymentRepository.update(created.id, ids);
  }

  async capture(payment: Payment) {
    if (!payment.squarePaymentId) return payment;
    try {
      await this.squareRepository.completePayment(payment.squarePaymentId);
    } catch (error) {
      await this.void(payment);
      throw new PaymentDeclinedError({ cause: error });
    }
    return (await this.paymentRepository.markPaid(payment.id)) ?? payment;
  }

  async void(payment: Payment) {
    if (payment.squarePaymentId) {
      await this.squareRepository.cancelPayment(payment.squarePaymentId);
    }
    return await this.paymentRepository.update(payment.id, { status: PAYMENT_STATUS.CANCELED });
  }

  /** Charges the card for a payment the customer was asked to pay. */
  async pay(payment: Payment, sourceId: string) {
    const claimed = await this.paymentRepository.transition(payment.id, PAYMENT_STATUS.PENDING, {
      status: PAYMENT_STATUS.PROCESSING,
    });
    if (!claimed) throw new PaymentStateError('This payment is not waiting to be paid');

    let ids: Awaited<ReturnType<typeof this.chargeCard>>;
    try {
      ids = await this.chargeCard(claimed, sourceId, CHARGE_MODE.CHARGE);
    } catch (error) {
      await this.paymentRepository.transition(claimed.id, PAYMENT_STATUS.PROCESSING, {
        status: PAYMENT_STATUS.PENDING,
      });
      throw error;
    }

    return await this.paymentRepository.transition(claimed.id, PAYMENT_STATUS.PROCESSING, {
      ...ids,
      status: PAYMENT_STATUS.PAID,
      paymentDate: DateTime.now(),
    });
  }

  async refund(payment: Payment) {
    if (payment.status !== PAYMENT_STATUS.PAID) return false;
    if (payment.squarePaymentId && payment.total > 0) {
      await this.squareRepository.refundPayment(payment.squarePaymentId, payment.total);
    }
    await this.paymentRepository.update(payment.id, {
      status: PAYMENT_STATUS.REFUNDED,
      refundedDate: DateTime.now(),
    });
    return true;
  }

  private async chargeCard(payment: Payment, sourceId: string, mode: ChargeMode) {
    const charged = lineItemsTotal(payment.lineItems) - discountTotal(payment);
    if (charged !== payment.total) {
      throw new Error(`Payment ${payment.id} line items do not add up to its total`);
    }

    const { locationId } = await this.settingsRepository.getSetting('printRequestSquare');
    const customer = await this.squareRepository.upsertCustomer(
      payment.customerName,
      payment.customerEmail,
    );
    const order = await this.squareRepository.createOrder({
      idempotencyKey: crypto.randomUUID(),
      order: {
        locationId,
        customerId: customer.id,
        referenceId: payment.id,
        ...squareOrderLines(payment.lineItems, payment.discounts),
      },
    });
    if (!order?.id) throw new Error('Failed to create order in Square');

    const squarePayment = await this.squareRepository
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
}
