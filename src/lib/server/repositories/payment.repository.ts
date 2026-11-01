import { UserError } from '$lib/errors';
import { schema, type Payment } from '$lib/server/db/schema';
import { BaseRepository } from '$lib/server/repositories/base.repository';
import {
  initialStatus,
  PAYMENT_STATUS,
  type Bill,
  type PaymentStatus,
  type PaymentType,
} from '$lib/utils/billing';
import { and, eq, inArray, type InferInsertModel } from 'drizzle-orm';
import { DateTime } from 'luxon';

export type PaymentCustomer = { name: string; email: string };

export type NewPayment = {
  type: PaymentType;
  status: PaymentStatus;
  customer: PaymentCustomer;
  bill: Pick<Bill, 'lineItems' | 'discounts' | 'total'>;
  organizationId?: string | null;
};

/** Safe to show the customer. */
export class PaymentError extends UserError {}

export class PaymentStateError extends PaymentError {}

const EDITABLE_STATUSES = [PAYMENT_STATUS.QUOTE, PAYMENT_STATUS.PENDING];

export class PaymentRepository extends BaseRepository {
  async getById(paymentId: string) {
    const [payment] = await this.db
      .select()
      .from(schema.payment)
      .where(eq(schema.payment.id, paymentId));
    return payment;
  }

  /**
   * Writes `payment` over the row with `id`, or a new row when there is none. Only a quote or an
   * unpaid bill can be overwritten.
   */
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
      // Only payments from before Orion billing keep a Square invoice and its link.
      paymentUrl: null,
      squareInvoiceId: null,
    };

    const [result] = await this.db
      .insert(schema.payment)
      .values({ ...values, ...(id && { id }) })
      .onConflictDoUpdate({
        target: schema.payment.id,
        set: values,
        setWhere: inArray(schema.payment.status, EDITABLE_STATUSES),
      })
      .returning();
    if (!result) throw new PaymentStateError('This payment can no longer be changed');
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
  async transition(
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

  /** Square invoices only exist on payments made before Orion billing. */
  async updateInvoiceStatus(
    invoiceId: string,
    status: typeof PAYMENT_STATUS.PAID | typeof PAYMENT_STATUS.CANCELED,
  ) {
    await this.db
      .update(schema.payment)
      .set({
        status: status,
        paymentDate: status === PAYMENT_STATUS.PAID ? DateTime.now() : undefined,
      })
      .where(eq(schema.payment.squareInvoiceId, invoiceId))
      .execute();
  }
}
