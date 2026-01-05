import { schema, type SquareWebhookLog } from '$lib/server/db/schema';
import { BaseRepository } from '$lib/server/repositories/base.repository';
import type { SquareWebhook } from '$lib/server/utils/square';
import type { CalculateOrderRequest, CreateOrderRequest, UpdateOrderRequest } from 'square';

export class SquareRepository extends BaseRepository {
  async getLocations() {
    const response = await this.square.locations.list();
    return response.locations ?? [];
  }

  async getCatalog() {
    const response = await this.square.catalog.list();
    return response.data ?? [];
  }

  async getCatalogByIds(ids: string[]) {
    return await this.square.catalog.batchGet({
      objectIds: ids,
    });
  }

  async getMembershipsByEmail(customerEmail: string) {
    const customerSearch = await this.square.customers.search({
      query: {
        filter: {
          emailAddress: {
            exact: customerEmail,
          },
        },
      },
    });

    const customers = customerSearch.customers ?? [];
    if (customers.length === 0) {
      return undefined;
    }

    const membershipsSearch = await this.square.subscriptions.search({
      query: {
        filter: {
          customerIds: [customers[0].id ?? ''],
        },
      },
    });

    return membershipsSearch.subscriptions;
  }

  async getOrderById(orderId: string) {
    const response = await this.square.orders.get({
      orderId,
    });

    return response.order;
  }

  async createOrder(order: CreateOrderRequest) {
    const created = await this.square.orders.create(order);
    return created.order;
  }

  async updateOrder(order: UpdateOrderRequest) {
    const updated = await this.square.orders.update(order);
    return updated.order;
  }

  async sendInvoice(invoiceId: string, invoiceVersion: number) {
    await this.square.invoices.publish({
      invoiceId,
      version: invoiceVersion,
    });
  }

  async calculateOrder(order: CalculateOrderRequest) {
    const calculated = await this.square.orders.calculate(order);
    return calculated.order;
  }

  async getInvoiceById(invoiceId: string) {
    const response = await this.square.invoices.get({
      invoiceId,
    });

    return response.invoice;
  }

  async cancelInvoice(invoiceId: string) {
    const invoice = await this.getInvoiceById(invoiceId);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (invoice.status === 'DRAFT') {
      await this.square.invoices.delete({
        invoiceId,
        version: invoice.version!,
      });
    } else if (invoice.status === 'SCHEDULED' || invoice.status === 'PAYMENT_PENDING') {
      await this.square.invoices.cancel({
        invoiceId,
        version: invoice.version!,
      });
    }
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

  async logWebhook(webhookData: SquareWebhook<any>) {
    const log = await this.db
      .insert(schema.squareWebhookLog)
      .values({
        id: webhookData.event_id,
        payload: webhookData,
      })
      .onConflictDoNothing()
      .returning()
      .get();

    return log as SquareWebhookLog | undefined;
  }
}
