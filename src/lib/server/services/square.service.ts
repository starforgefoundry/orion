import {
  MEMBER_EMAIL_TRIGGER,
  SUBSCRIPTION_STATUS,
  type MemberEmailTrigger,
} from '$lib/member_enums';
import type { Member, MemberSubscription } from '$lib/server/db/schema';
import { BaseService } from '$lib/server/services/base.service';
import { spaceDate } from '$lib/server/utils/member_access';
import {
  customerDisplayName,
  dayPassQuantity,
  memberSubscriptionStatus,
} from '$lib/server/utils/square';
import { DateTime } from 'luxon';
import type { Order, Payment, Subscription } from 'square';

const SUBSCRIPTION_EVENTS = new Set(['subscription.created', 'subscription.updated']);
const PAYMENT_UPDATED_EVENT = 'payment.updated';
const PAYMENT_COMPLETED_STATUS = 'COMPLETED';
const SQUARE_ACTIVE_STATUS = 'ACTIVE';
const ONBOARDING_SUBSCRIPTION_STATUSES = new Set<MemberSubscription['status']>([
  SUBSCRIPTION_STATUS.ACTIVE,
  SUBSCRIPTION_STATUS.PENDING,
]);
const FALLBACK_PLAN_NAME = 'Membership';

export const SUBSCRIPTION_SYNC_RESULT = {
  CREATED: 'created',
  UPDATED: 'updated',
  SKIPPED: 'skipped',
} as const;

export type SubscriptionSyncResult =
  (typeof SUBSCRIPTION_SYNC_RESULT)[keyof typeof SUBSCRIPTION_SYNC_RESULT];

type Buyer = { email: string; name?: string; customerId?: string };

export class SquareService extends BaseService {
  async getLocations() {
    return await this.squareRepository.getLocations();
  }

  async getCatalog() {
    return await this.squareRepository.getCatalog();
  }

  async processWebhook(webhookData: any) {
    const log = await this.squareRepository.logWebhook(webhookData);
    if (!log) {
      console.log('Already received and processed webhook event:', webhookData);
      return { success: true, message: 'Already received and processed webhook event' };
    }

    // Process different webhook event types
    if (webhookData.type === 'invoice.payment_made') {
      const invoiceId = webhookData.data.id;
      await this.paymentRepository.updateInvoiceStatus(invoiceId, 'paid');
    }

    if (webhookData.type === 'invoice.canceled') {
      const invoiceId = webhookData.data.id;
      await this.paymentRepository.updateInvoiceStatus(invoiceId, 'canceled');
    }

    if (SUBSCRIPTION_EVENTS.has(webhookData.type)) {
      const subscription = await this.squareRepository.getSubscription(webhookData.data.id);
      if (subscription) {
        await this.syncSubscription(subscription, true);
      }
    }

    if (webhookData.type === PAYMENT_UPDATED_EVENT) {
      await this.recordDayPasses(webhookData.data.id);
    }

    return { success: true };
  }

  /**
   * Imports active Square subscriptions and refreshes every one already stored, so a lost
   * webhook is corrected. The first import of existing subscribers should not email them.
   */
  async syncSubscriptions({ onboardNewMembers }: { onboardNewMembers: boolean }) {
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
      results.push(await this.syncSubscription(subscription, onboardNewMembers));
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
    sendOnboarding: boolean,
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

    if (created && sendOnboarding && ONBOARDING_SUBSCRIPTION_STATUSES.has(status)) {
      await this.sendOnboarding(member, MEMBER_EMAIL_TRIGGER.SUBSCRIPTION);
    }

    return created ? SUBSCRIPTION_SYNC_RESULT.CREATED : SUBSCRIPTION_SYNC_RESULT.UPDATED;
  }

  private async recordDayPasses(paymentId: string) {
    const { dayPassItemVariationIds } = await this.settingsRepository.getSetting('memberSquare');
    if (dayPassItemVariationIds.length === 0) return;

    const payment = await this.squareRepository.getPayment(paymentId);
    if (payment?.status !== PAYMENT_COMPLETED_STATUS || !payment.orderId) return;
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
        await this.memberNotificationRepository.sendDayPass(member, dayPass);
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
      await this.memberNotificationRepository.sendOnboarding(member, trigger);
    } catch (error) {
      console.error(`Failed to send ${trigger} onboarding email to member ${member.id}:`, error);
    }
  }
}

export const squareService = new SquareService();
