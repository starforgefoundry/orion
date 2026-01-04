import type { Location, Subscription } from 'square';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the repositories
vi.mock('$lib/server/repositories/square.repository', () => {
  const MockSquareRepository = vi.fn();
  MockSquareRepository.prototype.getLocations = vi.fn();
  MockSquareRepository.prototype.getCatalog = vi.fn();
  MockSquareRepository.prototype.getMembershipsByEmail = vi.fn();
  MockSquareRepository.prototype.logWebhook = vi.fn();
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

vi.mock('$lib/server/repositories/print_payment.repository', () => {
  const MockPrintPaymentRepository = vi.fn();
  MockPrintPaymentRepository.prototype.updateInvoiceStatus = vi.fn();
  return { PrintPaymentRepository: MockPrintPaymentRepository };
});

vi.mock('$lib/server/repositories/settings.repository', () => {
  const MockSettingsRepository = vi.fn();
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

    const { PrintPaymentRepository } =
      await import('$lib/server/repositories/print_payment.repository');
    mockPaymentRepo = PrintPaymentRepository.prototype;
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

  describe('checkActiveMember', () => {
    it('should return true when customer has active membership', async () => {
      // Arrange
      const customerEmail = 'member@example.com';
      const mockMemberships: Subscription[] = [
        {
          id: 'sub-123',
          status: 'ACTIVE',
          customerId: 'customer-123',
        },
      ];

      vi.mocked(mockSquareRepo.getMembershipsByEmail).mockResolvedValue(mockMemberships);

      // Act
      const result = await squareService.checkActiveMember(customerEmail);

      // Assert
      expect(mockSquareRepo.getMembershipsByEmail).toHaveBeenCalledWith(customerEmail);
      expect(result).toBe(true);
    });

    it('should return true when customer has multiple active memberships', async () => {
      // Arrange
      const customerEmail = 'multi-member@example.com';
      const mockMemberships: Subscription[] = [
        {
          id: 'sub-123',
          status: 'ACTIVE',
          customerId: 'customer-123',
        },
        {
          id: 'sub-456',
          status: 'ACTIVE',
          customerId: 'customer-123',
        },
      ];

      vi.mocked(mockSquareRepo.getMembershipsByEmail).mockResolvedValue(mockMemberships);

      // Act
      const result = await squareService.checkActiveMember(customerEmail);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false when customer has no memberships', async () => {
      // Arrange
      const customerEmail = 'nonmember@example.com';
      vi.mocked(mockSquareRepo.getMembershipsByEmail).mockResolvedValue([]);

      // Act
      const result = await squareService.checkActiveMember(customerEmail);

      // Assert
      expect(mockSquareRepo.getMembershipsByEmail).toHaveBeenCalledWith(customerEmail);
      expect(result).toBe(false);
    });

    it('should return false when memberships is null', async () => {
      // Arrange
      const customerEmail = 'nullmember@example.com';
      vi.mocked(mockSquareRepo.getMembershipsByEmail).mockResolvedValue(null);

      // Act
      const result = await squareService.checkActiveMember(customerEmail);

      // Assert
      expect(result).toBe(false);
    });

    it('should return false when customer has inactive memberships', async () => {
      // Arrange
      const customerEmail = 'expired@example.com';
      const mockMemberships: Subscription[] = [
        {
          id: 'sub-expired',
          status: 'CANCELED',
          customerId: 'customer-456',
        },
      ];

      vi.mocked(mockSquareRepo.getMembershipsByEmail).mockResolvedValue(mockMemberships);

      // Act
      const result = await squareService.checkActiveMember(customerEmail);

      // Assert
      expect(result).toBe(false);
    });

    it('should return false when all memberships are paused', async () => {
      // Arrange
      const customerEmail = 'paused@example.com';
      const mockMemberships: Subscription[] = [
        {
          id: 'sub-paused',
          status: 'PAUSED',
          customerId: 'customer-789',
        },
      ];

      vi.mocked(mockSquareRepo.getMembershipsByEmail).mockResolvedValue(mockMemberships);

      // Act
      const result = await squareService.checkActiveMember(customerEmail);

      // Assert
      expect(result).toBe(false);
    });

    it('should return true when customer has mix of active and inactive memberships', async () => {
      // Arrange
      const customerEmail = 'mixed@example.com';
      const mockMemberships: Subscription[] = [
        {
          id: 'sub-canceled',
          status: 'CANCELED',
          customerId: 'customer-999',
        },
        {
          id: 'sub-active',
          status: 'ACTIVE',
          customerId: 'customer-999',
        },
        {
          id: 'sub-paused',
          status: 'PAUSED',
          customerId: 'customer-999',
        },
      ];

      vi.mocked(mockSquareRepo.getMembershipsByEmail).mockResolvedValue(mockMemberships);

      // Act
      const result = await squareService.checkActiveMember(customerEmail);

      // Assert
      expect(result).toBe(true);
    });

    it('should handle different email formats correctly', async () => {
      // Arrange
      const emails = [
        'test@example.com',
        'TEST@EXAMPLE.COM',
        'user+tag@example.com',
        'first.last@example.co.uk',
      ];

      const mockMemberships: Subscription[] = [
        {
          id: 'sub-test',
          status: 'ACTIVE',
          customerId: 'customer-test',
        },
      ];

      vi.mocked(mockSquareRepo.getMembershipsByEmail).mockResolvedValue(mockMemberships);

      // Act & Assert
      for (const email of emails) {
        const result = await squareService.checkActiveMember(email);
        expect(mockSquareRepo.getMembershipsByEmail).toHaveBeenCalledWith(email);
        expect(result).toBe(true);
      }
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

    it('should handle repository errors gracefully in checkActiveMember', async () => {
      // Arrange
      const customerEmail = 'error@example.com';
      vi.mocked(mockSquareRepo.getMembershipsByEmail).mockRejectedValue(
        new Error('Membership lookup failed'),
      );

      // Act & Assert
      await expect(squareService.checkActiveMember(customerEmail)).rejects.toThrow(
        'Membership lookup failed',
      );
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
