import {
  MEMBER_EMAIL_TRIGGER,
  SUBSCRIPTION_STATUS,
  type EnumValue,
  type MemberEmailTrigger,
} from '$lib/utils/member-enums';
import type { Member, MemberSubscription } from '$lib/server/db/schema';
import { BaseService } from '$lib/server/services/base.service';
import { spaceDate } from '$lib/utils/space';
import {
  customerDisplayName,
  dayPassQuantity,
  memberSubscriptionStatus,
  SQUARE_PAYMENT_STATUS,
  type SquareWebhook,
} from '$lib/server/utils/square';
import { PAYMENT_STATUS } from '$lib/utils/billing';
import { DateTime } from 'luxon';
import type { Order, Payment, Subscription } from 'square';

const SQUARE_EVENT = {
  INVOICE_PAYMENT_MADE: 'invoice.payment_made',
  INVOICE_CANCELED: 'invoice.canceled',
  SUBSCRIPTION_CREATED: 'subscription.created',
  SUBSCRIPTION_UPDATED: 'subscription.updated',
  PAYMENT_UPDATED: 'payment.updated',
} as const;
type SquareEvent = EnumValue<typeof SQUARE_EVENT>;

const SQUARE_ACTIVE_STATUS = 'ACTIVE';
const ONBOARDING_SUBSCRIPTION_STATUSES = new Set<MemberSubscription['status']>([
  SUBSCRIPTION_STATUS.ACTIVE,
  SUBSCRIPTION_STATUS.PENDING,
]);
const FALLBACK_PLAN_NAME = 'Membership';
const DUPLICATE_WEBHOOK_MESSAGE = 'Already received and processed webhook event';

export const SUBSCRIPTION_SYNC_RESULT = {
  CREATED: 'created',
  UPDATED: 'updated',
  SKIPPED: 'skipped',
} as const;

export type SubscriptionSyncResult =
  (typeof SUBSCRIPTION_SYNC_RESULT)[keyof typeof SUBSCRIPTION_SYNC_RESULT];

/** Whether members created by a subscription sync get the welcome email. */
export const NEW_MEMBER_ONBOARDING = { SEND: 'send', SKIP: 'skip' } as const;
export type NewMemberOnboarding = EnumValue<typeof NEW_MEMBER_ONBOARDING>;

type Buyer = { email: string; name?: string; customerId?: string };

function isHandled(type: string): type is SquareEvent {
  return (Object.values(SQUARE_EVENT) as string[]).includes(type);
}

export class SquareService extends BaseService {
  private readonly webhookHandlers: Record<SquareEvent, (id: string) => Promise<unknown>> = {
    [SQUARE_EVENT.INVOICE_PAYMENT_MADE]: (invoiceId) =>
      this.paymentRepository.updateInvoiceStatus(invoiceId, PAYMENT_STATUS.PAID),
    [SQUARE_EVENT.INVOICE_CANCELED]: (invoiceId) =>
      this.paymentRepository.updateInvoiceStatus(invoiceId, PAYMENT_STATUS.CANCELED),
    [SQUARE_EVENT.SUBSCRIPTION_CREATED]: (subscriptionId) =>
      this.syncSubscriptionById(subscriptionId),
    [SQUARE_EVENT.SUBSCRIPTION_UPDATED]: (subscriptionId) =>
      this.syncSubscriptionById(subscriptionId),
    [SQUARE_EVENT.PAYMENT_UPDATED]: (paymentId) => this.recordDayPasses(paymentId),
  };

  async getLocations() {
    return await this.squareRepository.getLocations();
  }

  async getCatalog() {
    return await this.squareRepository.getCatalog();
  }

  /** A webhook that fails is forgotten so Square's retry of it is processed. */
  async processWebhook(webhook: SquareWebhook) {
    const log = await this.squareRepository.logWebhook(webhook);
    if (!log) {
      console.log('Already received and processed webhook event:', webhook);
      return { success: true, message: DUPLICATE_WEBHOOK_MESSAGE };
    }

    if (isHandled(webhook.type)) {
      try {
        await this.webhookHandlers[webhook.type](webhook.data.id);
      } catch (error) {
        await this.squareRepository.forgetWebhook(webhook.event_id);
        throw error;
      }
    }

    return { success: true };
  }

  private async syncSubscriptionById(subscriptionId: string) {
    const subscription = await this.squareRepository.getSubscription(subscriptionId);
    if (subscription) {
      await this.syncSubscription(subscription, NEW_MEMBER_ONBOARDING.SEND);
    }
  }

  /**
   * Imports active Square subscriptions and refreshes every one already stored, so a lost
   * webhook is corrected. The first import of existing subscribers should not email them.
   */
  async syncSubscriptions(onboarding: NewMemberOnboarding) {
    const [subscriptions, knownIds] = await Promise.all([
      this.squareRepository.listSubscriptions(),
      this.memberSubscriptionRepository.listIds(),
    ]);
    const known = new Set(knownIds);
    const toSync = subscriptions.filter(
      (subscription) =>
        subscription.status === SQUARE_ACTIVE_STATUS || known.has(subscription.id ?? ''),
    );

    const results: SubscriptionSyncResult[] = [];
    for (const subscription of toSync) {
      results.push(await this.syncSubscription(subscription, onboarding));
    }

    const countOf = (result: SubscriptionSyncResult) => results.filter((r) => r === result).length;
    return {
      total: results.length,
      created: countOf(SUBSCRIPTION_SYNC_RESULT.CREATED),
      updated: countOf(SUBSCRIPTION_SYNC_RESULT.UPDATED),
      skipped: countOf(SUBSCRIPTION_SYNC_RESULT.SKIPPED),
    };
  }

  private async syncSubscription(
    subscription: Subscription,
    onboarding: NewMemberOnboarding,
  ): Promise<SubscriptionSyncResult> {
    const customer = subscription.customerId
      ? await this.squareRepository.getCustomer(subscription.customerId)
      : undefined;
    if (!subscription.id || !subscription.planVariationId || !subscription.status) {
      console.warn('Skipping incomplete Square subscription:', subscription.id);
      return SUBSCRIPTION_SYNC_RESULT.SKIPPED;
    }
    if (!customer?.emailAddress) {
      console.warn('Skipping Square subscription without a customer email:', subscription.id);
      return SUBSCRIPTION_SYNC_RESULT.SKIPPED;
    }

    const email = customer.emailAddress;
    const member = await this.memberRepository.upsertByEmail(
      customerDisplayName(customer) ?? email,
      email,
    );
    if (customer.id) {
      await this.memberRepository.setSquareCustomerId(member.id, customer.id);
    }

    const planName =
      (await this.squareRepository.getPlanVariationName(subscription.planVariationId)) ??
      FALLBACK_PLAN_NAME;
    const status = memberSubscriptionStatus(subscription.status);

    const { created } = await this.memberSubscriptionRepository.upsert({
      id: subscription.id,
      memberId: member.id,
      planVariationId: subscription.planVariationId,
      planName,
      status,
      startDate: subscription.startDate ?? spaceDate(DateTime.now()),
      chargedThroughDate: subscription.chargedThroughDate ?? null,
      canceledDate: subscription.canceledDate ?? null,
    });

    const onboard = onboarding === NEW_MEMBER_ONBOARDING.SEND;
    if (created && onboard && ONBOARDING_SUBSCRIPTION_STATUSES.has(status)) {
      await this.sendOnboarding(member, MEMBER_EMAIL_TRIGGER.SUBSCRIPTION);
    }

    return created ? SUBSCRIPTION_SYNC_RESULT.CREATED : SUBSCRIPTION_SYNC_RESULT.UPDATED;
  }

  private async recordDayPasses(paymentId: string) {
    const { dayPassItemVariationIds } = await this.settingsRepository.getSetting('memberSquare');
    if (dayPassItemVariationIds.length === 0) return;

    const payment = await this.squareRepository.getPayment(paymentId);
    if (payment?.status !== SQUARE_PAYMENT_STATUS.COMPLETED || !payment.orderId) return;
    if (await this.dayPassRepository.existsForOrder(payment.orderId)) return;

    const order = await this.squareRepository.getOrderById(payment.orderId);
    if (!order) return;

    const quantity = dayPassQuantity(order, dayPassItemVariationIds);
    if (quantity === 0) return;

    // Walk-in POS sales usually have no email; those passes are intentionally not tracked.
    const buyer = await this.findBuyer(order, payment);
    if (!buyer) {
      console.warn('Skipping day pass order without a buyer email:', payment.orderId);
      return;
    }

    const member =
      (await this.memberRepository.getByEmail(buyer.email)) ??
      (await this.memberRepository.upsertByEmail(buyer.name ?? buyer.email, buyer.email));
    if (buyer.customerId && !member.squareCustomerId) {
      await this.memberRepository.setSquareCustomerId(member.id, buyer.customerId);
    }

    const purchasedAt = order.closedAt ?? payment.createdAt;
    const created = await this.dayPassRepository.createForOrder(
      member.id,
      payment.orderId,
      purchasedAt ? DateTime.fromISO(purchasedAt) : DateTime.now(),
      quantity,
    );
    for (const dayPass of created) {
      try {
        await this.memberNotificationGateway.sendDayPass(member, dayPass);
      } catch (error) {
        console.error(`Failed to send day pass ${dayPass.id} to member ${member.id}:`, error);
      }
    }
  }

  private async findBuyer(order: Order, payment: Payment): Promise<Buyer | undefined> {
    const orderCustomer = await this.customerBuyer(order.customerId);
    if (orderCustomer) return orderCustomer;

    if (payment.buyerEmailAddress) {
      return { email: payment.buyerEmailAddress, customerId: payment.customerId };
    }

    if (payment.customerId === order.customerId) return undefined;
    return await this.customerBuyer(payment.customerId);
  }

  private async customerBuyer(customerId?: string | null): Promise<Buyer | undefined> {
    if (!customerId) return undefined;

    const customer = await this.squareRepository.getCustomer(customerId);
    if (!customer?.emailAddress) return undefined;

    return {
      email: customer.emailAddress,
      name: customerDisplayName(customer),
      customerId,
    };
  }

  private async sendOnboarding(member: Member, trigger: MemberEmailTrigger) {
    try {
      await this.memberNotificationGateway.sendOnboarding(member, trigger);
    } catch (error) {
      console.error(`Failed to send ${trigger} onboarding email to member ${member.id}:`, error);
    }
  }
}

export const squareService = new SquareService();
