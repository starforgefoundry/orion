import type { Location, Subscription } from 'square';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the repositories
vi.mock('$lib/server/repositories/square.repository', () => {
  const MockSquareRepository = vi.fn();
  MockSquareRepository.prototype.getLocations = vi.fn();
  MockSquareRepository.prototype.getCatalog = vi.fn();
  MockSquareRepository.prototype.logWebhook = vi.fn();
  MockSquareRepository.prototype.getSubscription = vi.fn();
  MockSquareRepository.prototype.listSubscriptions = vi.fn();
  MockSquareRepository.prototype.getCustomer = vi.fn();
  MockSquareRepository.prototype.getPayment = vi.fn();
  MockSquareRepository.prototype.getOrderById = vi.fn();
  MockSquareRepository.prototype.getPlanVariationName = vi.fn();
  return { SquareRepository: MockSquareRepository };
});

vi.mock('$lib/server/repositories/print_files.repository', () => {
  const MockPrintFilesRepository = vi.fn();
  return { PrintFilesRepository: MockPrintFilesRepository };
});

vi.mock('$lib/server/repositories/print_materials.repository', () => {
  const MockPrintMaterialsRepository = vi.fn();
  return { PrintMaterialsRepository: MockPrintMaterialsRepository };
});

vi.mock('$lib/server/repositories/print_request.repository', () => {
  const MockPrintRequestRepository = vi.fn();
  return { PrintRequestRepository: MockPrintRequestRepository };
});

vi.mock('$lib/server/repositories/payment.repository', () => {
  const MockPaymentRepository = vi.fn();
  MockPaymentRepository.prototype.updateInvoiceStatus = vi.fn();
  return { PaymentRepository: MockPaymentRepository };
});

vi.mock('$lib/server/repositories/settings.repository', () => {
  const MockSettingsRepository = vi.fn();
  MockSettingsRepository.prototype.getSetting = vi.fn();
  return { SettingsRepository: MockSettingsRepository };
});

describe('SquareService', () => {
  let squareService: any;
  let mockSquareRepo: any;
  let mockPaymentRepo: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { SquareService } = await import('./square.service');
    squareService = new SquareService();

    const { SquareRepository } = await import('$lib/server/repositories/square.repository');
    mockSquareRepo = SquareRepository.prototype;

    const { PaymentRepository } = await import('$lib/server/repositories/payment.repository');
    mockPaymentRepo = PaymentRepository.prototype;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getLocations', () => {
    it('should return all locations from Square', async () => {
      // Arrange
      const mockLocations: Location[] = [
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

      vi.mocked(mockSquareRepo.getLocations).mockResolvedValue(mockLocations);

      // Act
      const result = await squareService.getLocations();

      // Assert
      expect(mockSquareRepo.getLocations).toHaveBeenCalled();
      expect(result).toEqual(mockLocations);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no locations exist', async () => {
      // Arrange
      vi.mocked(mockSquareRepo.getLocations).mockResolvedValue([]);

      // Act
      const result = await squareService.getLocations();

      // Assert
      expect(mockSquareRepo.getLocations).toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('should handle single location', async () => {
      // Arrange
      const mockLocation: Location = {
        id: 'loc-single',
        name: 'Only Location',
        address: {
          addressLine1: '789 Lone St',
        },
      };

      vi.mocked(mockSquareRepo.getLocations).mockResolvedValue([mockLocation]);

      // Act
      const result = await squareService.getLocations();

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('loc-single');
      expect(result[0].name).toBe('Only Location');
    });
  });

  describe('getCatalog', () => {
    it('should return catalog items from Square', async () => {
      // Arrange
      const mockCatalog = {
        objects: [
          {
            type: 'ITEM',
            id: 'item-123',
            itemData: {
              name: '3D Print Service',
            },
          },
          {
            type: 'DISCOUNT',
            id: 'discount-456',
            discountData: {
              name: 'Member Discount',
              percentage: '10',
            },
          },
        ],
      };

      vi.mocked(mockSquareRepo.getCatalog).mockResolvedValue(mockCatalog);

      // Act
      const result = await squareService.getCatalog();

      // Assert
      expect(mockSquareRepo.getCatalog).toHaveBeenCalled();
      expect(result).toEqual(mockCatalog);
      expect(result.objects).toHaveLength(2);
    });

    it('should return empty catalog when no items exist', async () => {
      // Arrange
      const mockEmptyCatalog = { objects: [] };
      vi.mocked(mockSquareRepo.getCatalog).mockResolvedValue(mockEmptyCatalog);

      // Act
      const result = await squareService.getCatalog();

      // Assert
      expect(mockSquareRepo.getCatalog).toHaveBeenCalled();
      expect(result.objects).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('should handle repository errors gracefully in getLocations', async () => {
      // Arrange
      vi.mocked(mockSquareRepo.getLocations).mockRejectedValue(new Error('Square API error'));

      // Act & Assert
      await expect(squareService.getLocations()).rejects.toThrow('Square API error');
    });

    it('should handle repository errors gracefully in getCatalog', async () => {
      // Arrange
      vi.mocked(mockSquareRepo.getCatalog).mockRejectedValue(new Error('Catalog not available'));

      // Act & Assert
      await expect(squareService.getCatalog()).rejects.toThrow('Catalog not available');
    });
  });

  describe('processWebhook', () => {
    it('should process invoice.payment_made webhook event', async () => {
      // Arrange
      const webhookData = {
        type: 'invoice.payment_made',
        data: {
          id: 'inv-paid-123',
        },
      };

      const mockLog = { id: 'log-1', eventId: 'evt-1' };

      vi.mocked(mockSquareRepo.logWebhook).mockResolvedValue(mockLog);
      vi.mocked(mockPaymentRepo.updateInvoiceStatus).mockResolvedValue(undefined);

      // Act
      const result = await squareService.processWebhook(webhookData);

      // Assert
      expect(mockSquareRepo.logWebhook).toHaveBeenCalledWith(webhookData);
      expect(mockPaymentRepo.updateInvoiceStatus).toHaveBeenCalledWith('inv-paid-123', 'paid');
      expect(result).toEqual({ success: true });
    });

    it('should process invoice.canceled webhook event', async () => {
      // Arrange
      const webhookData = {
        type: 'invoice.canceled',
        data: {
          id: 'inv-canceled-456',
        },
      };

      const mockLog = { id: 'log-2', eventId: 'evt-2' };

      vi.mocked(mockSquareRepo.logWebhook).mockResolvedValue(mockLog);
      vi.mocked(mockPaymentRepo.updateInvoiceStatus).mockResolvedValue(undefined);

      // Act
      const result = await squareService.processWebhook(webhookData);

      // Assert
      expect(mockSquareRepo.logWebhook).toHaveBeenCalledWith(webhookData);
      expect(mockPaymentRepo.updateInvoiceStatus).toHaveBeenCalledWith(
        'inv-canceled-456',
        'canceled',
      );
      expect(result).toEqual({ success: true });
    });

    it('should handle duplicate webhook events', async () => {
      // Arrange
      const webhookData = {
        type: 'invoice.payment_made',
        data: {
          id: 'inv-duplicate-789',
        },
      };

      vi.mocked(mockSquareRepo.logWebhook).mockResolvedValue(null);

      // Act
      const result = await squareService.processWebhook(webhookData);

      // Assert
      expect(mockSquareRepo.logWebhook).toHaveBeenCalledWith(webhookData);
      expect(mockPaymentRepo.updateInvoiceStatus).not.toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        message: 'Already received and processed webhook event',
      });
    });

    it('should ignore unknown webhook event types', async () => {
      // Arrange
      const webhookData = {
        type: 'unknown.event.type',
        data: {
          id: 'some-id',
        },
      };

      const mockLog = { id: 'log-3', eventId: 'evt-3' };

      vi.mocked(mockSquareRepo.logWebhook).mockResolvedValue(mockLog);

      // Act
      const result = await squareService.processWebhook(webhookData);

      // Assert
      expect(mockSquareRepo.logWebhook).toHaveBeenCalledWith(webhookData);
      expect(mockPaymentRepo.updateInvoiceStatus).not.toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it('should handle webhook with missing data', async () => {
      // Arrange
      const webhookData = {
        type: 'invoice.payment_made',
        data: {},
      };

      const mockLog = { id: 'log-4', eventId: 'evt-4' };

      vi.mocked(mockSquareRepo.logWebhook).mockResolvedValue(mockLog);
      vi.mocked(mockPaymentRepo.updateInvoiceStatus).mockResolvedValue(undefined);

      // Act
      const result = await squareService.processWebhook(webhookData);

      // Assert
      expect(mockSquareRepo.logWebhook).toHaveBeenCalledWith(webhookData);
      expect(mockPaymentRepo.updateInvoiceStatus).toHaveBeenCalledWith(undefined, 'paid');
      expect(result).toEqual({ success: true });
    });

    it('should handle multiple webhook events in sequence', async () => {
      // Arrange
      const webhook1 = {
        type: 'invoice.payment_made',
        data: { id: 'inv-1' },
      };
      const webhook2 = {
        type: 'invoice.canceled',
        data: { id: 'inv-2' },
      };

      vi.mocked(mockSquareRepo.logWebhook).mockResolvedValue({ id: 'log' });
      vi.mocked(mockPaymentRepo.updateInvoiceStatus).mockResolvedValue(undefined);

      // Act
      await squareService.processWebhook(webhook1);
      await squareService.processWebhook(webhook2);

      // Assert
      expect(mockSquareRepo.logWebhook).toHaveBeenCalledTimes(2);
      expect(mockPaymentRepo.updateInvoiceStatus).toHaveBeenNthCalledWith(1, 'inv-1', 'paid');
      expect(mockPaymentRepo.updateInvoiceStatus).toHaveBeenNthCalledWith(2, 'inv-2', 'canceled');
    });

    it('should handle errors in webhook processing', async () => {
      // Arrange
      const webhookData = {
        type: 'invoice.payment_made',
        data: { id: 'inv-error' },
      };

      vi.mocked(mockSquareRepo.logWebhook).mockResolvedValue({ id: 'log' });
      vi.mocked(mockPaymentRepo.updateInvoiceStatus).mockRejectedValue(new Error('Update failed'));

      // Act & Assert
      await expect(squareService.processWebhook(webhookData)).rejects.toThrow('Update failed');
    });
  });
});

describe('SquareService member sync', () => {
  const MEMBER = { id: 'member-1', email: 'ada@example.com', squareCustomerId: null };
  const CUSTOMER = {
    id: 'cust-1',
    givenName: 'Ada',
    familyName: 'Lovelace',
    emailAddress: 'ada@example.com',
  };
  const SUBSCRIPTION: Subscription = {
    id: 'sub-1',
    customerId: 'cust-1',
    planVariationId: 'plan-var-1',
    status: 'ACTIVE',
    startDate: '2026-10-01',
    chargedThroughDate: '2026-11-01',
  };
  const DAY_PASS_VARIATION = 'day-pass-var';

  let service: any;
  let squareRepo: any;
  let settingsRepo: any;
  let memberRepo: any;
  let memberSubscriptionRepo: any;
  let dayPassRepo: any;
  let notificationRepo: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { SquareRepository } = await import('$lib/server/repositories/square.repository');
    squareRepo = SquareRepository.prototype;
    const { SettingsRepository } = await import('$lib/server/repositories/settings.repository');
    settingsRepo = SettingsRepository.prototype;

    memberRepo = {
      upsertByEmail: vi.fn().mockResolvedValue(MEMBER),
      getByEmail: vi.fn().mockResolvedValue(undefined),
      setSquareCustomerId: vi.fn(),
    };
    memberSubscriptionRepo = {
      upsert: vi.fn().mockResolvedValue({ created: true }),
      listIds: vi.fn().mockResolvedValue([]),
    };
    dayPassRepo = {
      existsForOrder: vi.fn().mockResolvedValue(false),
      createForOrder: vi.fn().mockResolvedValue([]),
    };
    notificationRepo = { sendOnboarding: vi.fn().mockResolvedValue(undefined) };

    squareRepo.logWebhook.mockResolvedValue({ id: 'log' });
    squareRepo.getSubscription.mockResolvedValue(SUBSCRIPTION);
    squareRepo.getCustomer.mockResolvedValue(CUSTOMER);
    squareRepo.getPlanVariationName.mockResolvedValue('Monthly Membership');
    settingsRepo.getSetting.mockResolvedValue({ dayPassItemVariationIds: [DAY_PASS_VARIATION] });

    const { SquareService } = await import('./square.service');
    service = new SquareService(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      {
        memberRepository: memberRepo,
        memberSubscriptionRepository: memberSubscriptionRepo,
        dayPassRepository: dayPassRepo,
        memberNotificationRepository: notificationRepo,
      },
    );
  });

  const subscriptionWebhook = (type = 'subscription.created') => ({
    type,
    event_id: 'evt-sub',
    data: { id: 'sub-1' },
  });

  describe('subscription webhooks', () => {
    it('upserts the member and subscription, then sends onboarding', async () => {
      await service.processWebhook(subscriptionWebhook());

      expect(memberRepo.upsertByEmail).toHaveBeenCalledWith('Ada Lovelace', 'ada@example.com');
      expect(memberRepo.setSquareCustomerId).toHaveBeenCalledWith('member-1', 'cust-1');
      expect(memberSubscriptionRepo.upsert).toHaveBeenCalledWith({
        id: 'sub-1',
        memberId: 'member-1',
        planVariationId: 'plan-var-1',
        planName: 'Monthly Membership',
        status: 'active',
        startDate: '2026-10-01',
        chargedThroughDate: '2026-11-01',
        canceledDate: null,
      });
      expect(notificationRepo.sendOnboarding).toHaveBeenCalledWith(MEMBER, 'subscription');
    });

    it('handles subscription.updated the same way', async () => {
      memberSubscriptionRepo.upsert.mockResolvedValue({ created: false });
      squareRepo.getSubscription.mockResolvedValue({
        ...SUBSCRIPTION,
        status: 'CANCELED',
        canceledDate: '2026-10-20',
      });

      await service.processWebhook(subscriptionWebhook('subscription.updated'));

      expect(memberSubscriptionRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'canceled', canceledDate: '2026-10-20' }),
      );
      expect(notificationRepo.sendOnboarding).not.toHaveBeenCalled();
    });

    it('does not onboard a newly seen canceled subscription', async () => {
      squareRepo.getSubscription.mockResolvedValue({ ...SUBSCRIPTION, status: 'CANCELED' });

      await service.processWebhook(subscriptionWebhook());

      expect(notificationRepo.sendOnboarding).not.toHaveBeenCalled();
    });

    it('skips customers without an email', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      squareRepo.getCustomer.mockResolvedValue({ ...CUSTOMER, emailAddress: undefined });

      await service.processWebhook(subscriptionWebhook());

      expect(warn).toHaveBeenCalled();
      expect(memberRepo.upsertByEmail).not.toHaveBeenCalled();
      expect(memberSubscriptionRepo.upsert).not.toHaveBeenCalled();
      warn.mockRestore();
    });

    it('falls back to the email when the customer has no name', async () => {
      squareRepo.getCustomer.mockResolvedValue({ id: 'cust-1', emailAddress: 'ada@example.com' });

      await service.processWebhook(subscriptionWebhook());

      expect(memberRepo.upsertByEmail).toHaveBeenCalledWith('ada@example.com', 'ada@example.com');
    });

    it('does not fail the webhook when onboarding fails', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      notificationRepo.sendOnboarding.mockRejectedValue(new Error('Mailgun down'));

      await expect(service.processWebhook(subscriptionWebhook())).resolves.toEqual({
        success: true,
      });
      error.mockRestore();
    });
  });

  describe('syncSubscriptions', () => {
    it('upserts every active subscription without onboarding and returns counts', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      squareRepo.listSubscriptions.mockResolvedValue([
        SUBSCRIPTION,
        { ...SUBSCRIPTION, id: 'sub-2' },
        { ...SUBSCRIPTION, id: 'sub-3', customerId: undefined },
      ]);
      memberSubscriptionRepo.upsert
        .mockResolvedValueOnce({ created: true })
        .mockResolvedValueOnce({ created: false });

      const result = await service.syncSubscriptions({ onboardNewMembers: false });

      expect(result).toEqual({ total: 3, created: 1, updated: 1, skipped: 1 });
      expect(memberSubscriptionRepo.upsert).toHaveBeenCalledTimes(2);
      expect(notificationRepo.sendOnboarding).not.toHaveBeenCalled();
      warn.mockRestore();
    });

    it('refreshes known subscriptions that are no longer active and ignores unknown ones', async () => {
      squareRepo.listSubscriptions.mockResolvedValue([
        { ...SUBSCRIPTION, id: 'known-canceled', status: 'CANCELED' },
        { ...SUBSCRIPTION, id: 'unknown-canceled', status: 'CANCELED' },
      ]);
      memberSubscriptionRepo.listIds.mockResolvedValue(['known-canceled']);
      memberSubscriptionRepo.upsert.mockResolvedValue({ created: false });

      const result = await service.syncSubscriptions({ onboardNewMembers: false });

      expect(result).toEqual({ total: 1, created: 0, updated: 1, skipped: 0 });
      expect(memberSubscriptionRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'known-canceled', status: 'canceled' }),
      );
    });

    it('onboards subscribers whose webhook was missed when asked to', async () => {
      squareRepo.listSubscriptions.mockResolvedValue([SUBSCRIPTION]);
      memberSubscriptionRepo.upsert.mockResolvedValue({ created: true });

      await service.syncSubscriptions({ onboardNewMembers: true });

      expect(notificationRepo.sendOnboarding).toHaveBeenCalledWith(MEMBER, 'subscription');
    });
  });

  describe('day pass webhooks', () => {
    const paymentWebhook = { type: 'payment.updated', event_id: 'evt-pay', data: { id: 'pay-1' } };
    const PAYMENT = {
      id: 'pay-1',
      status: 'COMPLETED',
      orderId: 'order-1',
      createdAt: '2026-10-16T15:00:00Z',
    };
    const ORDER = {
      id: 'order-1',
      customerId: 'cust-1',
      closedAt: '2026-10-16T15:01:00Z',
      lineItems: [
        { catalogObjectId: DAY_PASS_VARIATION, quantity: '2' },
        { catalogObjectId: 'other-item', quantity: '5' },
      ],
    };

    beforeEach(() => {
      squareRepo.getPayment.mockResolvedValue(PAYMENT);
      squareRepo.getOrderById.mockResolvedValue(ORDER);
      dayPassRepo.createForOrder.mockResolvedValue([{ id: 'order-1:0' }, { id: 'order-1:1' }]);
    });

    it('creates one pass per day pass item and sends onboarding', async () => {
      await service.processWebhook(paymentWebhook);

      expect(dayPassRepo.createForOrder).toHaveBeenCalledWith(
        'member-1',
        'order-1',
        expect.anything(),
        2,
      );
      expect(dayPassRepo.createForOrder.mock.calls[0][2].toUTC().toISO()).toContain(
        '2026-10-16T15:01',
      );
      expect(memberRepo.setSquareCustomerId).toHaveBeenCalledWith('member-1', 'cust-1');
      expect(notificationRepo.sendOnboarding).toHaveBeenCalledWith(MEMBER, 'day_pass');
    });

    it('keeps an existing member name', async () => {
      memberRepo.getByEmail.mockResolvedValue({ ...MEMBER, squareCustomerId: 'cust-1' });

      await service.processWebhook(paymentWebhook);

      expect(memberRepo.upsertByEmail).not.toHaveBeenCalled();
      expect(memberRepo.setSquareCustomerId).not.toHaveBeenCalled();
    });

    it('is idempotent per order', async () => {
      dayPassRepo.existsForOrder.mockResolvedValue(true);

      await service.processWebhook(paymentWebhook);

      expect(dayPassRepo.createForOrder).not.toHaveBeenCalled();
    });

    it('does not resend onboarding when a concurrent webhook already created the passes', async () => {
      dayPassRepo.createForOrder.mockResolvedValue([]);

      await service.processWebhook(paymentWebhook);

      expect(notificationRepo.sendOnboarding).not.toHaveBeenCalled();
    });

    it('ignores payments that are not completed', async () => {
      squareRepo.getPayment.mockResolvedValue({ ...PAYMENT, status: 'APPROVED' });

      await service.processWebhook(paymentWebhook);

      expect(squareRepo.getOrderById).not.toHaveBeenCalled();
    });

    it('ignores orders without day pass items', async () => {
      squareRepo.getOrderById.mockResolvedValue({ ...ORDER, lineItems: ORDER.lineItems.slice(1) });

      await service.processWebhook(paymentWebhook);

      expect(dayPassRepo.createForOrder).not.toHaveBeenCalled();
    });

    it('does nothing when no day pass items are configured', async () => {
      settingsRepo.getSetting.mockResolvedValue({ dayPassItemVariationIds: [] });

      await service.processWebhook(paymentWebhook);

      expect(squareRepo.getPayment).not.toHaveBeenCalled();
    });

    it('uses the payment buyer email when the order has no customer', async () => {
      squareRepo.getOrderById.mockResolvedValue({ ...ORDER, customerId: undefined });
      squareRepo.getPayment.mockResolvedValue({ ...PAYMENT, buyerEmailAddress: 'bob@example.com' });

      await service.processWebhook(paymentWebhook);

      expect(memberRepo.upsertByEmail).toHaveBeenCalledWith('bob@example.com', 'bob@example.com');
    });

    it('falls back to the payment customer record', async () => {
      squareRepo.getOrderById.mockResolvedValue({ ...ORDER, customerId: undefined });
      squareRepo.getPayment.mockResolvedValue({ ...PAYMENT, customerId: 'cust-1' });

      await service.processWebhook(paymentWebhook);

      expect(squareRepo.getCustomer).toHaveBeenCalledWith('cust-1');
      expect(memberRepo.upsertByEmail).toHaveBeenCalledWith('Ada Lovelace', 'ada@example.com');
    });

    it('skips walk-in orders without any email', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      squareRepo.getOrderById.mockResolvedValue({ ...ORDER, customerId: undefined });

      await service.processWebhook(paymentWebhook);

      expect(dayPassRepo.createForOrder).not.toHaveBeenCalled();
      expect(notificationRepo.sendOnboarding).not.toHaveBeenCalled();
      warn.mockRestore();
    });
  });
});
