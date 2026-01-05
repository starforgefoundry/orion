import { schema } from '$lib/server/db/schema';
import { BaseRepository } from '$lib/server/repositories/base.repository';
import { eq, type InferInsertModel } from 'drizzle-orm';
import { DateTime } from 'luxon';
import type { Order } from 'square';

export class PrintPaymentRepository extends BaseRepository {
  async getById(paymentId: string) {
    return await this.db
      .select()
      .from(schema.printRequestPayment)
      .where(eq(schema.printRequestPayment.id, paymentId))
      .get();
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

  async savePayment(
    requestId: string,
    payment: InferInsertModel<typeof schema.printRequestPayment>,
  ) {
    const { id, ...rest } = payment;

    const result = await this.db
      .insert(schema.printRequestPayment)
      .values(payment)
      .onConflictDoUpdate({
        target: schema.printRequestPayment.id,
        set: rest,
      })
      .returning()
      .get();

    await this.db
      .update(schema.printRequest)
      .set({
        paymentId: result.id,
      })
      .where(eq(schema.printRequest.id, requestId))
      .execute();

    return result;
  }

  async updatePayment(
    paymentId: string,
    updates: Partial<InferInsertModel<typeof schema.printRequestPayment>>,
  ) {
    return await this.db
      .update(schema.printRequestPayment)
      .set(updates)
      .where(eq(schema.printRequestPayment.id, paymentId))
      .returning();
  }

  async updateInvoiceStatus(invoiceId: string, status: 'paid' | 'canceled') {
    await this.db
      .update(schema.printRequestPayment)
      .set({
        status: status,
        paymentDate: status === 'paid' ? DateTime.now() : undefined,
      })
      .where(eq(schema.printRequestPayment.squareInvoiceId, invoiceId))
      .execute();
  }

  async getByPrintRequestId(printRequestId: string) {
    const result = await this.db
      .select()
      .from(schema.printRequest)
      .where(eq(schema.printRequest.id, printRequestId))
      .leftJoin(
        schema.printRequestPayment,
        eq(schema.printRequest.paymentId, schema.printRequestPayment.id),
      )
      .get();

    if (!result) {
      return null;
    }

    return result.print_request_payment;
  }
}
