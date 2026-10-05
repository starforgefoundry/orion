import { schema } from '$lib/server/db/schema';
import { BaseRepository } from '$lib/server/repositories/base.repository';
import { eq, type InferInsertModel } from 'drizzle-orm';
import { DateTime } from 'luxon';
import type { Order } from 'square';

export class PaymentRepository extends BaseRepository {
  async getById(paymentId: string) {
    const [payment] = await this.db
      .select()
      .from(schema.payment)
      .where(eq(schema.payment.id, paymentId));
    return payment;
  }

  async createInvoice(order: Order) {
    const created = await this.square.invoices.create({
      invoice: {
        locationId: order.locationId,
        orderId: order.id!,
        primaryRecipient: {
          customerId: order.customerId!,
        },
        paymentRequests: [
          {
            requestType: 'BALANCE',
            dueDate: DateTime.now().plus({ days: 1 }).toFormat('yyyy-MM-dd'),
          },
        ],
        acceptedPaymentMethods: {
          card: true,
          cashAppPay: true,
        },
        deliveryMethod: 'EMAIL',
      },
    });

    return created.invoice;
  }

  async savePayment(requestId: string, payment: InferInsertModel<typeof schema.payment>) {
    const { id, ...rest } = payment;

    const [result] = await this.db
      .insert(schema.payment)
      .values(payment)
      .onConflictDoUpdate({
        target: schema.payment.id,
        set: rest,
      })
      .returning();

    await this.db
      .update(schema.printRequest)
      .set({
        paymentId: result.id,
      })
      .where(eq(schema.printRequest.id, requestId))
      .execute();

    return result;
  }

  async createStandalonePayment(payment: InferInsertModel<typeof schema.payment>) {
    const [result] = await this.db.insert(schema.payment).values(payment).returning();

    return result;
  }

  async updatePayment(
    paymentId: string,
    updates: Partial<InferInsertModel<typeof schema.payment>>,
  ) {
    return await this.db
      .update(schema.payment)
      .set(updates)
      .where(eq(schema.payment.id, paymentId))
      .returning();
  }

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

  async getByPrintRequestId(printRequestId: string) {
    const [result] = await this.db
      .select()
      .from(schema.printRequest)
      .where(eq(schema.printRequest.id, printRequestId))
      .leftJoin(schema.payment, eq(schema.printRequest.paymentId, schema.payment.id));

    if (!result) {
      return null;
    }

    return result.payment;
  }
}
