import type { SquareWebhookLog } from '$lib/server/db/schema';
import { factory } from '$test/factory';
import { catalogDiscount, squareCustomer, squareOrder } from '$test/factory/square';
import { newTestService, stubSettings, type ServiceMocks } from '$test/utils';
import type { CatalogObject, Location, Payment, Subscription } from 'square';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SquareService } from './square.service';

function webhookLog(id = 'evt'): SquareWebhookLog {
  return { id, payload: {} };
}

function invoiceWebhook(type: string, invoiceId: string) {
  return { type, data: { id: invoiceId } };
}

describe(SquareService.name, () => {
  let sut: SquareService;
  let mocks: ServiceMocks;

  beforeEach(() => {
    ({ sut, mocks } = newTestService(SquareService));
  });

  describe('getLocations', () => {
    it('should return all locations from Square', async () => {
      const locations: Location[] = [
        {
          id: 'loc-123',
          name: 'Main Location',
          address: {
            addressLine1: '123 Main St',
            locality: 'Seattle',
            administrativeDistrictLevel1: 'WA',
            postalCode: '98101',
          },
        },
        {
          id: 'loc-456',
          name: 'Secondary Location',
          address: {
            addressLine1: '456 Second Ave',
            locality: 'Portland',
            administrativeDistrictLevel1: 'OR',
            postalCode: '97201',
          },
        },
      ];
      mocks.squareRepository.getLocations.mockResolvedValue(locations);

      const result = await sut.getLocations();

      expect(mocks.squareRepository.getLocations).toHaveBeenCalled();
      expect(result).toEqual(locations);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no locations exist', async () => {
      mocks.squareRepository.getLocations.mockResolvedValue([]);

      const result = await sut.getLocations();

      expect(mocks.squareRepository.getLocations).toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('should handle single location', async () => {
      mocks.squareRepository.getLocations.mockResolvedValue([
        { id: 'loc-single', name: 'Only Location', address: { addressLine1: '789 Lone St' } },
      ]);

      const result = await sut.getLocations();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('loc-single');
      expect(result[0].name).toBe('Only Location');
    });

    it('should handle repository errors gracefully', async () => {
      mocks.squareRepository.getLocations.mockRejectedValue(new Error('Square API error'));

      await expect(sut.getLocations()).rejects.toThrow('Square API error');
    });
  });

  describe('getCatalog', () => {
    it('should return catalog items from Square', async () => {
      const catalog: CatalogObject[] = [
        { type: 'ITEM', id: 'item-123', itemData: { name: '3D Print Service' } },
        catalogDiscount('discount-456', { name: 'Member Discount', percentage: '10' }),
      ];
      mocks.squareRepository.getCatalog.mockResolvedValue(catalog);

      const result = await sut.getCatalog();

      expect(mocks.squareRepository.getCatalog).toHaveBeenCalled();
      expect(result).toEqual(catalog);
      expect(result).toHaveLength(2);
    });

    it('should return empty catalog when no items exist', async () => {
      mocks.squareRepository.getCatalog.mockResolvedValue([]);

      const result = await sut.getCatalog();

      expect(mocks.squareRepository.getCatalog).toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('should handle repository errors gracefully', async () => {
      mocks.squareRepository.getCatalog.mockRejectedValue(new Error('Catalog not available'));

      await expect(sut.getCatalog()).rejects.toThrow('Catalog not available');
    });
  });

  describe('processWebhook', () => {
    beforeEach(() => {
      mocks.squareRepository.logWebhook.mockResolvedValue(webhookLog());
      mocks.paymentRepository.updateInvoiceStatus.mockResolvedValue();
    });

    it('should process invoice.payment_made webhook event', async () => {
      const webhookData = invoiceWebhook('invoice.payment_made', 'inv-paid-123');

      const result = await sut.processWebhook(webhookData);

      expect(mocks.squareRepository.logWebhook).toHaveBeenCalledWith(webhookData);
      expect(mocks.paymentRepository.updateInvoiceStatus).toHaveBeenCalledWith(
        'inv-paid-123',
        'paid',
      );
      expect(result).toEqual({ success: true });
    });

    it('should process invoice.canceled webhook event', async () => {
      const webhookData = invoiceWebhook('invoice.canceled', 'inv-canceled-456');

      const result = await sut.processWebhook(webhookData);

      expect(mocks.squareRepository.logWebhook).toHaveBeenCalledWith(webhookData);
      expect(mocks.paymentRepository.updateInvoiceStatus).toHaveBeenCalledWith(
        'inv-canceled-456',
        'canceled',
      );
      expect(result).toEqual({ success: true });
    });

    it('should handle duplicate webhook events', async () => {
      const webhookData = invoiceWebhook('invoice.payment_made', 'inv-duplicate-789');
      mocks.squareRepository.logWebhook.mockResolvedValue(undefined);

      const result = await sut.processWebhook(webhookData);

      expect(mocks.squareRepository.logWebhook).toHaveBeenCalledWith(webhookData);
      expect(mocks.paymentRepository.updateInvoiceStatus).not.toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        message: 'Already received and processed webhook event',
      });
    });

    it('should ignore unknown webhook event types', async () => {
      const webhookData = invoiceWebhook('unknown.event.type', 'some-id');

      const result = await sut.processWebhook(webhookData);

      expect(mocks.squareRepository.logWebhook).toHaveBeenCalledWith(webhookData);
      expect(mocks.paymentRepository.updateInvoiceStatus).not.toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it('should handle webhook with missing data', async () => {
      const webhookData = { type: 'invoice.payment_made', data: {} };

      const result = await sut.processWebhook(webhookData);

      expect(mocks.squareRepository.logWebhook).toHaveBeenCalledWith(webhookData);
      expect(mocks.paymentRepository.updateInvoiceStatus).toHaveBeenCalledWith(undefined, 'paid');
      expect(result).toEqual({ success: true });
    });

    it('should handle multiple webhook events in sequence', async () => {
      await sut.processWebhook(invoiceWebhook('invoice.payment_made', 'inv-1'));
      await sut.processWebhook(invoiceWebhook('invoice.canceled', 'inv-2'));

      expect(mocks.squareRepository.logWebhook).toHaveBeenCalledTimes(2);
      expect(mocks.paymentRepository.updateInvoiceStatus).toHaveBeenNthCalledWith(
        1,
        'inv-1',
        'paid',
      );
      expect(mocks.paymentRepository.updateInvoiceStatus).toHaveBeenNthCalledWith(
        2,
        'inv-2',
        'canceled',
      );
    });

    it('should handle errors in webhook processing', async () => {
      mocks.paymentRepository.updateInvoiceStatus.mockRejectedValue(new Error('Update failed'));

      await expect(
        sut.processWebhook(invoiceWebhook('invoice.payment_made', 'inv-error')),
      ).rejects.toThrow('Update failed');
    });
  });

  describe('member sync', () => {
    const DAY_PASS_VARIATION = 'day-pass-var';
    const member = factory.member({ email: 'ada@example.com', squareCustomerId: null });
    const customer = squareCustomer({
      id: 'cust-1',
      givenName: 'Ada',
      familyName: 'Lovelace',
      emailAddress: 'ada@example.com',
    });
    const subscription: Subscription = {
      id: 'sub-1',
      customerId: 'cust-1',
      planVariationId: 'plan-var-1',
      status: 'ACTIVE',
      startDate: '2026-10-01',
      chargedThroughDate: '2026-11-01',
    };

    beforeEach(() => {
      mocks.memberRepository.upsertByEmail.mockResolvedValue(member);
      mocks.memberRepository.getByEmail.mockResolvedValue(undefined as never);
      mocks.memberRepository.setSquareCustomerId.mockResolvedValue();
      mocks.memberSubscriptionRepository.upsert.mockResolvedValue({ created: true });
      mocks.memberSubscriptionRepository.listIds.mockResolvedValue([]);
      mocks.dayPassRepository.existsForOrder.mockResolvedValue(false);
      mocks.dayPassRepository.createForOrder.mockResolvedValue([]);
      mocks.memberNotificationRepository.sendOnboarding.mockResolvedValue();
      mocks.memberNotificationRepository.sendDayPass.mockResolvedValue();
      mocks.squareRepository.logWebhook.mockResolvedValue(webhookLog());
      mocks.squareRepository.getSubscription.mockResolvedValue(subscription);
      mocks.squareRepository.getCustomer.mockResolvedValue(customer);
      mocks.squareRepository.getPlanVariationName.mockResolvedValue('Monthly Membership');
      stubSettings(mocks.settingsRepository, {
        memberSquare: { dayPassItemVariationIds: [DAY_PASS_VARIATION] },
      });
    });

    const subscriptionWebhook = (type = 'subscription.created') => ({
      type,
      event_id: 'evt-sub',
      data: { id: 'sub-1' },
    });

    describe('subscription webhooks', () => {
      it('upserts the member and subscription, then sends onboarding', async () => {
        await sut.processWebhook(subscriptionWebhook());

        expect(mocks.memberRepository.upsertByEmail).toHaveBeenCalledWith(
          'Ada Lovelace',
          'ada@example.com',
        );
        expect(mocks.memberRepository.setSquareCustomerId).toHaveBeenCalledWith(
          member.id,
          'cust-1',
        );
        expect(mocks.memberSubscriptionRepository.upsert).toHaveBeenCalledWith({
          id: 'sub-1',
          memberId: member.id,
          planVariationId: 'plan-var-1',
          planName: 'Monthly Membership',
          status: 'active',
          startDate: '2026-10-01',
          chargedThroughDate: '2026-11-01',
          canceledDate: null,
        });
        expect(mocks.memberNotificationRepository.sendOnboarding).toHaveBeenCalledWith(
          member,
          'subscription',
        );
      });

      it('handles subscription.updated the same way', async () => {
        mocks.memberSubscriptionRepository.upsert.mockResolvedValue({ created: false });
        mocks.squareRepository.getSubscription.mockResolvedValue({
          ...subscription,
          status: 'CANCELED',
          canceledDate: '2026-10-20',
        });

        await sut.processWebhook(subscriptionWebhook('subscription.updated'));

        expect(mocks.memberSubscriptionRepository.upsert).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'canceled', canceledDate: '2026-10-20' }),
        );
        expect(mocks.memberNotificationRepository.sendOnboarding).not.toHaveBeenCalled();
      });

      it('does not onboard a newly seen canceled subscription', async () => {
        mocks.squareRepository.getSubscription.mockResolvedValue({
          ...subscription,
          status: 'CANCELED',
        });

        await sut.processWebhook(subscriptionWebhook());

        expect(mocks.memberNotificationRepository.sendOnboarding).not.toHaveBeenCalled();
      });

      it('skips customers without an email', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        mocks.squareRepository.getCustomer.mockResolvedValue({
          ...customer,
          emailAddress: undefined,
        });

        await sut.processWebhook(subscriptionWebhook());

        expect(warn).toHaveBeenCalled();
        expect(mocks.memberRepository.upsertByEmail).not.toHaveBeenCalled();
        expect(mocks.memberSubscriptionRepository.upsert).not.toHaveBeenCalled();
      });

      it('falls back to the email when the customer has no name', async () => {
        mocks.squareRepository.getCustomer.mockResolvedValue(
          squareCustomer({
            id: 'cust-1',
            emailAddress: 'ada@example.com',
            givenName: undefined,
            familyName: undefined,
          }),
        );

        await sut.processWebhook(subscriptionWebhook());

        expect(mocks.memberRepository.upsertByEmail).toHaveBeenCalledWith(
          'ada@example.com',
          'ada@example.com',
        );
      });

      it('does not fail the webhook when onboarding fails', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        mocks.memberNotificationRepository.sendOnboarding.mockRejectedValue(
          new Error('Mailgun down'),
        );

        await expect(sut.processWebhook(subscriptionWebhook())).resolves.toEqual({
          success: true,
        });
      });
    });

    describe('syncSubscriptions', () => {
      it('upserts every active subscription without onboarding and returns counts', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        mocks.squareRepository.listSubscriptions.mockResolvedValue([
          subscription,
          { ...subscription, id: 'sub-2' },
          { ...subscription, id: 'sub-3', customerId: undefined },
        ]);
        mocks.memberSubscriptionRepository.upsert
          .mockResolvedValueOnce({ created: true })
          .mockResolvedValueOnce({ created: false });

        const result = await sut.syncSubscriptions({ onboardNewMembers: false });

        expect(result).toEqual({ total: 3, created: 1, updated: 1, skipped: 1 });
        expect(mocks.memberSubscriptionRepository.upsert).toHaveBeenCalledTimes(2);
        expect(mocks.memberNotificationRepository.sendOnboarding).not.toHaveBeenCalled();
      });

      it('refreshes known subscriptions that are no longer active and ignores unknown ones', async () => {
        mocks.squareRepository.listSubscriptions.mockResolvedValue([
          { ...subscription, id: 'known-canceled', status: 'CANCELED' },
          { ...subscription, id: 'unknown-canceled', status: 'CANCELED' },
        ]);
        mocks.memberSubscriptionRepository.listIds.mockResolvedValue(['known-canceled']);
        mocks.memberSubscriptionRepository.upsert.mockResolvedValue({ created: false });

        const result = await sut.syncSubscriptions({ onboardNewMembers: false });

        expect(result).toEqual({ total: 1, created: 0, updated: 1, skipped: 0 });
        expect(mocks.memberSubscriptionRepository.upsert).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'known-canceled', status: 'canceled' }),
        );
      });

      it('onboards subscribers whose webhook was missed when asked to', async () => {
        mocks.squareRepository.listSubscriptions.mockResolvedValue([subscription]);

        await sut.syncSubscriptions({ onboardNewMembers: true });

        expect(mocks.memberNotificationRepository.sendOnboarding).toHaveBeenCalledWith(
          member,
          'subscription',
        );
      });
    });

    describe('day pass webhooks', () => {
      const paymentWebhook = {
        type: 'payment.updated',
        event_id: 'evt-pay',
        data: { id: 'pay-1' },
      };
      const payment: Payment = {
        id: 'pay-1',
        status: 'COMPLETED',
        orderId: 'order-1',
        createdAt: '2026-10-16T15:00:00Z',
      };
      const order = squareOrder({
        id: 'order-1',
        customerId: 'cust-1',
        closedAt: '2026-10-16T15:01:00Z',
        lineItems: [
          { catalogObjectId: DAY_PASS_VARIATION, quantity: '2' },
          { catalogObjectId: 'other-item', quantity: '5' },
        ],
      });

      beforeEach(() => {
        mocks.squareRepository.getPayment.mockResolvedValue(payment);
        mocks.squareRepository.getOrderById.mockResolvedValue(order);
        mocks.dayPassRepository.createForOrder.mockResolvedValue([
          factory.dayPass({ id: 'order-1:0', memberId: member.id, squareOrderId: 'order-1' }),
          factory.dayPass({ id: 'order-1:1', memberId: member.id, squareOrderId: 'order-1' }),
        ]);
      });

      it('creates one pass per day pass item and emails each one', async () => {
        await sut.processWebhook(paymentWebhook);

        expect(mocks.dayPassRepository.createForOrder).toHaveBeenCalledWith(
          member.id,
          'order-1',
          expect.anything(),
          2,
        );
        expect(mocks.dayPassRepository.createForOrder.mock.calls[0][2].toUTC().toISO()).toContain(
          '2026-10-16T15:01',
        );
        expect(mocks.memberRepository.setSquareCustomerId).toHaveBeenCalledWith(
          member.id,
          'cust-1',
        );
        expect(mocks.memberNotificationRepository.sendDayPass).toHaveBeenCalledTimes(2);
        expect(mocks.memberNotificationRepository.sendDayPass).toHaveBeenCalledWith(
          member,
          expect.objectContaining({ id: 'order-1:1' }),
        );
        expect(mocks.memberNotificationRepository.sendOnboarding).not.toHaveBeenCalled();
      });

      it('still sends the other passes when one email fails', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        mocks.memberNotificationRepository.sendDayPass.mockRejectedValueOnce(
          new Error('Mailgun down'),
        );

        await expect(sut.processWebhook(paymentWebhook)).resolves.toEqual({ success: true });
        expect(mocks.memberNotificationRepository.sendDayPass).toHaveBeenCalledTimes(2);
      });

      it('keeps an existing member name', async () => {
        mocks.memberRepository.getByEmail.mockResolvedValue({
          ...member,
          squareCustomerId: 'cust-1',
        });

        await sut.processWebhook(paymentWebhook);

        expect(mocks.memberRepository.upsertByEmail).not.toHaveBeenCalled();
        expect(mocks.memberRepository.setSquareCustomerId).not.toHaveBeenCalled();
      });

      it('is idempotent per order', async () => {
        mocks.dayPassRepository.existsForOrder.mockResolvedValue(true);

        await sut.processWebhook(paymentWebhook);

        expect(mocks.dayPassRepository.createForOrder).not.toHaveBeenCalled();
      });

      it('does not resend passes when a concurrent webhook already created them', async () => {
        mocks.dayPassRepository.createForOrder.mockResolvedValue([]);

        await sut.processWebhook(paymentWebhook);

        expect(mocks.memberNotificationRepository.sendDayPass).not.toHaveBeenCalled();
      });

      it('ignores payments that are not completed', async () => {
        mocks.squareRepository.getPayment.mockResolvedValue({ ...payment, status: 'APPROVED' });

        await sut.processWebhook(paymentWebhook);

        expect(mocks.squareRepository.getOrderById).not.toHaveBeenCalled();
      });

      it('ignores orders without day pass items', async () => {
        mocks.squareRepository.getOrderById.mockResolvedValue({
          ...order,
          lineItems: order.lineItems?.slice(1),
        });

        await sut.processWebhook(paymentWebhook);

        expect(mocks.dayPassRepository.createForOrder).not.toHaveBeenCalled();
      });

      it('does nothing when no day pass items are configured', async () => {
        stubSettings(mocks.settingsRepository, { memberSquare: { dayPassItemVariationIds: [] } });

        await sut.processWebhook(paymentWebhook);

        expect(mocks.squareRepository.getPayment).not.toHaveBeenCalled();
      });

      it('uses the payment buyer email when the order has no customer', async () => {
        mocks.squareRepository.getOrderById.mockResolvedValue({ ...order, customerId: undefined });
        mocks.squareRepository.getPayment.mockResolvedValue({
          ...payment,
          buyerEmailAddress: 'bob@example.com',
        });

        await sut.processWebhook(paymentWebhook);

        expect(mocks.memberRepository.upsertByEmail).toHaveBeenCalledWith(
          'bob@example.com',
          'bob@example.com',
        );
      });

      it('falls back to the payment customer record', async () => {
        mocks.squareRepository.getOrderById.mockResolvedValue({ ...order, customerId: undefined });
        mocks.squareRepository.getPayment.mockResolvedValue({ ...payment, customerId: 'cust-1' });

        await sut.processWebhook(paymentWebhook);

        expect(mocks.squareRepository.getCustomer).toHaveBeenCalledWith('cust-1');
        expect(mocks.memberRepository.upsertByEmail).toHaveBeenCalledWith(
          'Ada Lovelace',
          'ada@example.com',
        );
      });

      it('skips walk-in orders without any email', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        mocks.squareRepository.getOrderById.mockResolvedValue({ ...order, customerId: undefined });

        await sut.processWebhook(paymentWebhook);

        expect(mocks.dayPassRepository.createForOrder).not.toHaveBeenCalled();
        expect(mocks.memberNotificationRepository.sendOnboarding).not.toHaveBeenCalled();
      });
    });
  });
});
