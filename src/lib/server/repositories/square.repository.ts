import { schema, type SquareWebhookLog } from '$lib/server/db/schema';
import { BaseRepository } from '$lib/server/repositories/base.repository';
import { SQUARE_CURRENCY, type SquareWebhook } from '$lib/server/utils/square';
import type {
  CalculateOrderRequest,
  CreateOrderRequest,
  CreatePaymentRequest,
  Customer,
  Invoice,
  Payment,
  Subscription,
  UpdateOrderRequest,
} from 'square';

const SUBSCRIPTION_REFUND_KEY_PREFIX = 'refund-';
const INVOICE_PAID_STATUS = 'PAID';
const SUBSCRIPTION_REFUND_REASON = 'Membership access ended';

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
    const response = await this.square.invoices.publish({
      invoiceId,
      version: invoiceVersion,
    });

    return response.invoice;
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
    } else if (
      invoice.status === 'SCHEDULED' ||
      invoice.status === 'PAYMENT_PENDING' ||
      invoice.status === 'UNPAID'
    ) {
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

  /** With `autocomplete: false` the card is only authorized until `completePayment` captures it. */
  async createPayment(payment: CreatePaymentRequest) {
    const response = await this.square.payments.create(payment);
    return response.payment;
  }

  async completePayment(paymentId: string) {
    const response = await this.square.payments.complete({ paymentId });
    return response.payment;
  }

  async cancelPayment(paymentId: string) {
    const response = await this.square.payments.cancel({ paymentId });
    return response.payment;
  }

  async refundPayment(paymentId: string, amountCents: number) {
    const response = await this.square.refunds.refundPayment({
      paymentId,
      idempotencyKey: crypto.randomUUID(),
      amountMoney: {
        amount: BigInt(amountCents),
        currency: SQUARE_CURRENCY,
      },
    });

    return response.refund;
  }

  async getSubscription(subscriptionId: string): Promise<Subscription | undefined> {
    const response = await this.square.subscriptions.get({ subscriptionId });
    return response.subscription;
  }

  async listSubscriptions(): Promise<Subscription[]> {
    const subscriptions: Subscription[] = [];
    let cursor: string | undefined;

    do {
      const response = await this.square.subscriptions.search({ cursor });
      subscriptions.push(...(response.subscriptions ?? []));
      cursor = response.cursor;
    } while (cursor);

    return subscriptions;
  }

  async getCustomer(customerId: string): Promise<Customer | undefined> {
    const response = await this.square.customers.get({ customerId });
    return response.customer;
  }

  async getPayment(paymentId: string): Promise<Payment | undefined> {
    const response = await this.square.payments.get({ paymentId });
    return response.payment;
  }

  async getPlanVariationName(planVariationId: string): Promise<string | undefined> {
    const response = await this.square.catalog.object.get({ objectId: planVariationId });
    const object = response.object;
    if (object?.type !== 'SUBSCRIPTION_PLAN_VARIATION') return undefined;

    return object.subscriptionPlanVariationData?.name;
  }

  /** Cancels at the end of the current billing period. */
  async cancelSubscription(subscriptionId: string): Promise<void> {
    await this.square.subscriptions.cancel({ subscriptionId });
  }

  async refundLatestSubscriptionPayment(subscriptionId: string): Promise<string> {
    const subscription = await this.getSubscription(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const invoice = await this.findLatestPaidInvoice(subscription.invoiceIds ?? []);
    if (!invoice?.orderId) {
      throw new Error('No paid invoice found for this subscription');
    }

    const order = await this.getOrderById(invoice.orderId);
    const paymentId = order?.tenders?.[0]?.id;
    if (!paymentId) {
      throw new Error('No payment found for the latest invoice');
    }

    const payment = await this.getPayment(paymentId);
    const amountMoney = payment?.totalMoney ?? payment?.amountMoney;
    if (!amountMoney) {
      throw new Error('Payment has no amount to refund');
    }

    await this.square.refunds.refundPayment({
      idempotencyKey: `${SUBSCRIPTION_REFUND_KEY_PREFIX}${paymentId}`,
      paymentId,
      amountMoney,
      reason: SUBSCRIPTION_REFUND_REASON,
    });

    return paymentId;
  }

  /** Square lists a subscription's invoices newest first. */
  private async findLatestPaidInvoice(invoiceIds: string[]): Promise<Invoice | undefined> {
    for (const invoiceId of invoiceIds) {
      const invoice = await this.getInvoiceById(invoiceId);
      if (invoice?.status === INVOICE_PAID_STATUS) return invoice;
    }
    return undefined;
  }

  async logWebhook(webhookData: SquareWebhook<any>) {
    const [log] = await this.db
      .insert(schema.squareWebhookLog)
      .values({
        id: webhookData.event_id,
        payload: webhookData,
      })
      .onConflictDoNothing()
      .returning();

    return log as SquareWebhookLog | undefined;
  }
}
