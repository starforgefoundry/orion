import { schema } from '$lib/server/db/schema';
import { BaseRepository } from '$lib/server/repositories/base.repository';
import { eq, type InferInsertModel } from 'drizzle-orm';
import { DateTime } from 'luxon';
import type { CalculateOrderRequest, CreateOrderRequest, Order } from 'square';

export class PrintPaymentRepository extends BaseRepository {
  async getById(paymentId: string) {
    return await this.db
      .select()
      .from(schema.printRequestPayment)
      .where(eq(schema.printRequestPayment.id, paymentId))
      .get();
  }

  async upsertCustomer(name: string, email: string) {
    const customerSearch = await this.square.customers.search({
      query: {
        filter: {
          emailAddress: {
            exact: email,
          },
        },
      },
    });

    const customers = customerSearch.customers ?? [];
    if (customers.length > 0) {
      return customers[0];
    }

    const [firstName, ...lastNameParts] = name.split(' ');
    const lastName = lastNameParts.join(' ');
    const createdCustomer = await this.square.customers.create({
      givenName: firstName,
      familyName: lastName,
      emailAddress: email,
    });

    if (!createdCustomer.customer) {
      throw new Error('Failed to create customer in Square');
    }

    return createdCustomer.customer;
  }

  async createOrder(order: CreateOrderRequest) {
    const created = await this.square.orders.create(order);
    return created.order;
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
            dueDate: DateTime.now().toFormat('yyyy-MM-dd'),
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

  async sendInvoice(invoiceId: string, invoiceVersion: number) {
    await this.square.invoices.publish({
      invoiceId,
      version: invoiceVersion,
    });
  }

  async calculateCost(order: CalculateOrderRequest) {
    const calculated = await this.square.orders.calculate(order);
    return calculated.order?.netAmountDueMoney?.amount ?? BigInt(0);
  }

  async savePayment(
    requestId: string,
    payment: InferInsertModel<typeof schema.printRequestPayment>,
  ) {
    const result = await this.db
      .insert(schema.printRequestPayment)
      .values(payment)
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
}
