import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Location, Subscription } from 'square';

// Mock the repositories
vi.mock('$lib/server/repositories/square.repository', () => {
  const MockSquareRepository = vi.fn();
  MockSquareRepository.prototype.getLocations = vi.fn();
  MockSquareRepository.prototype.getCatalog = vi.fn();
  MockSquareRepository.prototype.getMembershipsByEmail = vi.fn();
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
  return { PrintPaymentRepository: MockPrintPaymentRepository };
});

vi.mock('$lib/server/repositories/settings.repository', () => {
  const MockSettingsRepository = vi.fn();
  return { SettingsRepository: MockSettingsRepository };
});

describe('SquareService', () => {
  let squareService: any;
  let mockSquareRepo: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { SquareService } = await import('./square.service');
    squareService = new SquareService();

    const { SquareRepository } = await import('$lib/server/repositories/square.repository');
    mockSquareRepo = SquareRepository.prototype;
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
      vi.mocked(mockSquareRepo.getLocations).mockRejectedValue(
        new Error('Square API error'),
      );

      // Act & Assert
      await expect(squareService.getLocations()).rejects.toThrow('Square API error');
    });

    it('should handle repository errors gracefully in getCatalog', async () => {
      // Arrange
      vi.mocked(mockSquareRepo.getCatalog).mockRejectedValue(
        new Error('Catalog not available'),
      );

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
});
