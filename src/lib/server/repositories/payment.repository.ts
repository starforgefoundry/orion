import { schema, type Payment } from '$lib/server/db/schema';
import type { Database } from '$lib/server/db';
import { BaseRepository } from '$lib/server/repositories/base.repository';
import { SettingsRepository } from '$lib/server/repositories/settings.repository';
import { SquareRepository } from '$lib/server/repositories/square.repository';
import { SQUARE_CURRENCY, squareOrderLines } from '$lib/server/utils/square';
import {
  initialStatus,
  lineItemsTotal,
  PAYMENT_STATUS,
  type Bill,
  type PaymentStatus,
  type PaymentType,
} from '$lib/utils/billing';
import { and, eq, type InferInsertModel } from 'drizzle-orm';
import { DateTime } from 'luxon';
import type { SquareClient } from 'square';

const APPROVED_PAYMENT_STATUS = 'APPROVED';
const COMPLETED_PAYMENT_STATUS = 'COMPLETED';

export type PaymentCustomer = { name: string; email: string };

export type NewPayment = {
  type: PaymentType;
  status: PaymentStatus;
  customer: PaymentCustomer;
  bill: Pick<Bill, 'lineItems' | 'discounts' | 'total'>;
  organizationId?: string | null;
  paymentUrl?: string | null;
};

export class PaymentDeclinedError extends Error {
  constructor(options?: ErrorOptions) {
    super('Payment failed. Please check your card details and try again.', options);
  }
}

export class PaymentRepository extends BaseRepository {
  private squareRepository: SquareRepository;
  private settingsRepository: SettingsRepository;

  constructor(
    db?: Database,
    square?: SquareClient,
    squareRepository?: SquareRepository,
    settingsRepository?: SettingsRepository,
  ) {
    super(db, square);
    this.squareRepository = squareRepository ?? new SquareRepository(db, square);
    this.settingsRepository = settingsRepository ?? new SettingsRepository(db, square);
  }

  async getById(paymentId: string) {
    const [payment] = await this.db
      .select()
      .from(schema.payment)
      .where(eq(schema.payment.id, paymentId));
    return payment;
  }

  /** Writes `payment` over the row with `id`, or a new row when there is none. */
  async save(payment: NewPayment, id?: string) {
    const status = initialStatus(payment.status, payment.bill.total);
    const values = {
      type: payment.type,
      status,
      issuedDate: DateTime.now(),
      paymentDate: status === PAYMENT_STATUS.PAID ? DateTime.now() : null,
      customerName: payment.customer.name,
      customerEmail: payment.customer.email,
      lineItems: payment.bill.lineItems,
      discounts: payment.bill.discounts,
      total: payment.bill.total,
      organizationId: payment.organizationId ?? null,
      paymentUrl: payment.paymentUrl ?? null,
      squareInvoiceId: null,
    };

    const [result] = await this.db
      .insert(schema.payment)
      .values({ ...values, ...(id && { id }) })
      .onConflictDoUpdate({ target: schema.payment.id, set: values })
      .returning();
    return result;
  }

  async update(paymentId: string, updates: Partial<InferInsertModel<typeof schema.payment>>) {
    const [payment] = await this.db
      .update(schema.payment)
      .set(updates)
      .where(eq(schema.payment.id, paymentId))
      .returning();
    return payment;
  }

  /** Moves a payment out of `from` only if nothing else already did. */
  private async transition(
    paymentId: string,
    from: PaymentStatus,
    updates: Partial<InferInsertModel<typeof schema.payment>>,
  ) {
    const [payment] = await this.db
      .update(schema.payment)
      .set(updates)
      .where(and(eq(schema.payment.id, paymentId), eq(schema.payment.status, from)))
      .returning();
    return payment;
  }

  async approveQuote(payment: Payment) {
    return await this.transition(payment.id, PAYMENT_STATUS.QUOTE, {
      status: initialStatus(PAYMENT_STATUS.PENDING, payment.total),
      paymentDate: payment.total === 0 ? DateTime.now() : null,
    });
  }

  async markPaid(paymentId: string) {
    return await this.transition(paymentId, PAYMENT_STATUS.PENDING, {
      status: PAYMENT_STATUS.PAID,
      paymentDate: DateTime.now(),
    });
  }

  /** Cancels any Square invoice a pre-Orion payment was sent as. */
  async cancel(payment: Payment) {
    if (payment.status === PAYMENT_STATUS.CANCELED) return payment;
    if (payment.squareInvoiceId && payment.status !== PAYMENT_STATUS.PAID) {
      await this.squareRepository.cancelInvoice(payment.squareInvoiceId);
    }
    return await this.update(payment.id, { status: PAYMENT_STATUS.CANCELED });
  }

  /**
   * Holds the amount on the card without taking it, so a booking that falls through can be
   * voided instead of refunded. The payment stays pending until `capture`.
   */
  async authorize(payment: NewPayment, sourceId: string) {
    const created = await this.save({ ...payment, status: PAYMENT_STATUS.PENDING });
    if (created.status === PAYMENT_STATUS.PAID) return created;

    const ids = await this.chargeCard(created, sourceId, false).catch(async (error) => {
      await this.update(created.id, { status: PAYMENT_STATUS.CANCELED });
      throw error;
    });
    return await this.update(created.id, ids);
  }

  async capture(payment: Payment) {
    if (!payment.squarePaymentId) return payment;
    try {
      await this.squareRepository.completePayment(payment.squarePaymentId);
    } catch (error) {
      await this.void(payment);
      throw new PaymentDeclinedError({ cause: error });
    }
    return (await this.markPaid(payment.id)) ?? payment;
  }

  async void(payment: Payment) {
    if (payment.squarePaymentId) {
      await this.squareRepository.cancelPayment(payment.squarePaymentId);
    }
    return await this.update(payment.id, { status: PAYMENT_STATUS.CANCELED });
  }

  /** Charges the card for a payment the customer was asked to pay. */
  async pay(payment: Payment, sourceId: string) {
    if (payment.status !== PAYMENT_STATUS.PENDING) {
      throw new Error('This payment is not waiting to be paid');
    }

    const ids = await this.chargeCard(payment, sourceId, true);
    await this.update(payment.id, ids);
    return (await this.markPaid(payment.id)) ?? (await this.getById(payment.id));
  }

  async refund(payment: Payment) {
    if (payment.status !== PAYMENT_STATUS.PAID) return false;
    if (payment.squarePaymentId && payment.total > 0) {
      await this.squareRepository.refundPayment(payment.squarePaymentId, payment.total);
    }
    await this.update(payment.id, {
      status: PAYMENT_STATUS.REFUNDED,
      refundedDate: DateTime.now(),
    });
    return true;
  }

  private async chargeCard(payment: Payment, sourceId: string, autocomplete: boolean) {
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

    const expected = autocomplete ? COMPLETED_PAYMENT_STATUS : APPROVED_PAYMENT_STATUS;
    const squarePayment = await this.squareRepository
      .createPayment({
        sourceId,
        idempotencyKey: crypto.randomUUID(),
        amountMoney: { amount: BigInt(payment.total), currency: SQUARE_CURRENCY },
        orderId: order.id,
        locationId,
        customerId: customer.id,
        buyerEmailAddress: payment.customerEmail || undefined,
        autocomplete,
      })
      .catch((error) => {
        throw new PaymentDeclinedError({ cause: error });
      });
    if (!squarePayment?.id || squarePayment.status !== expected) {
      throw new PaymentDeclinedError();
    }

    return { squareOrderId: order.id, squarePaymentId: squarePayment.id };
  }

  /** Square invoices only exist on payments made before Orion billing. */
  async updateInvoiceStatus(invoiceId: string, status: 'paid' | 'canceled') {
    await this.db
      .update(schema.payment)
      .set({
        status: status,
        paymentDate: status === 'paid' ? DateTime.now() : undefined,
      })
      .where(eq(schema.payment.squareInvoiceId, invoiceId))
      .execute();
  }
}

function discountTotal(payment: Pick<Payment, 'discounts'>) {
  return payment.discounts.reduce((total, discount) => total + discount.amount, 0);
}
