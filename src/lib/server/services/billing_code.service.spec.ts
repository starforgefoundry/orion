import type {
  CreateBillingCodeDto,
  UpdateBillingCodeDto,
} from '$lib/remotes/dtos/billing_code.dto';
import type { CatalogObject } from 'square';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BillingCodeService } from './billing_code.service';

// Mock remote endpoints to avoid SvelteKit request store errors
vi.mock('$lib/remotes/endpoints/billing_code.remote', () => ({
  getBillingCodes: vi.fn(() => ({
    refresh: vi.fn().mockResolvedValue(undefined),
  })),
  getBillingCodeById: vi.fn(() => ({
    refresh: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe('BillingCodeService', () => {
  let billingCodeService: BillingCodeService;
  let mockBillingCodeRepo: any;
  let mockSquareRepo: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockBillingCodeRepo = {
      create: vi.fn(),
      getAll: vi.fn(),
      getById: vi.fn(),
      getByCode: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    mockSquareRepo = {
      getCatalogByIds: vi.fn(),
    };

    billingCodeService = new BillingCodeService(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      mockSquareRepo,
      undefined,
      undefined,
      undefined,
      mockBillingCodeRepo,
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getBillingCodes', () => {
    it('should return all billing codes with discount names and organization names', async () => {
      // Arrange
      const mockCodes = [
        {
          billingCode: {
            id: 'code-1',
            code: 'TEST1',
            description: 'Test code 1',
            organizationId: 'org-1',
            discountId: 'discount-1',
          },
          organization: {
            id: 'org-1',
            name: 'Test Organization',
            email: 'org@test.com',
            archived: false,
          },
        },
        {
          billingCode: {
            id: 'code-2',
            code: 'TEST2',
            description: 'Test code 2',
            organizationId: null,
            discountId: 'discount-2',
          },
          organization: null,
        },
        {
          billingCode: {
            id: 'code-3',
            code: 'TEST3',
            description: 'Test code 3',
            organizationId: 'org-2',
            discountId: null,
          },
          organization: {
            id: 'org-2',
            name: 'Another Org',
            email: 'another@test.com',
            archived: false,
          },
        },
      ];

      const mockCatalog: CatalogObject[] = [
        {
          type: 'DISCOUNT',
          id: 'discount-1',
          discountData: {
            name: 'Member Discount',
          },
        },
        {
          type: 'DISCOUNT',
          id: 'discount-2',
          discountData: {
            name: 'Student Discount',
          },
        },
      ];

      vi.mocked(mockBillingCodeRepo.getAll).mockResolvedValue(mockCodes);
      vi.mocked(mockSquareRepo.getCatalogByIds).mockResolvedValue({
        objects: mockCatalog,
      });

      // Act
      const result = await billingCodeService.getBillingCodes();

      // Assert
      expect(mockBillingCodeRepo.getAll).toHaveBeenCalled();
      expect(mockSquareRepo.getCatalogByIds).toHaveBeenCalledWith(['discount-1', 'discount-2']);
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        id: 'code-1',
        code: 'TEST1',
        description: 'Test code 1',
        organizationId: 'org-1',
        discountId: 'discount-1',
        organizationName: 'Test Organization',
        discountName: 'Member Discount',
      });
      expect(result[1]).toEqual({
        id: 'code-2',
        code: 'TEST2',
        description: 'Test code 2',
        organizationId: null,
        discountId: 'discount-2',
        organizationName: null,
        discountName: 'Student Discount',
      });
      expect(result[2]).toEqual({
        id: 'code-3',
        code: 'TEST3',
        description: 'Test code 3',
        organizationId: 'org-2',
        discountId: null,
        organizationName: 'Another Org',
        discountName: null,
      });
    });

    it('should return billing codes without calling Square when no discounts exist', async () => {
      // Arrange
      const mockCodes = [
        {
          billingCode: {
            id: 'code-1',
            code: 'NODISCOUNT',
            description: 'Code without discount',
            organizationId: 'org-1',
            discountId: null,
          },
          organization: {
            id: 'org-1',
            name: 'Test Org',
            email: 'test@org.com',
            archived: false,
          },
        },
      ];

      vi.mocked(mockBillingCodeRepo.getAll).mockResolvedValue(mockCodes);

      // Act
      const result = await billingCodeService.getBillingCodes();

      // Assert
      expect(mockBillingCodeRepo.getAll).toHaveBeenCalled();
      expect(mockSquareRepo.getCatalogByIds).not.toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].discountName).toBeNull();
    });

    it('should handle unnamed discounts from Square', async () => {
      // Arrange
      const mockCodes = [
        {
          billingCode: {
            id: 'code-1',
            code: 'UNNAMED',
            description: 'Code with unnamed discount',
            organizationId: null,
            discountId: 'discount-unnamed',
          },
          organization: null,
        },
      ];

      const mockCatalog: CatalogObject[] = [
        {
          type: 'DISCOUNT',
          id: 'discount-unnamed',
          discountData: {
            // No name provided
          },
        },
      ];

      vi.mocked(mockBillingCodeRepo.getAll).mockResolvedValue(mockCodes);
      vi.mocked(mockSquareRepo.getCatalogByIds).mockResolvedValue({
        objects: mockCatalog,
      });

      // Act
      const result = await billingCodeService.getBillingCodes();

      // Assert
      expect(result[0].discountName).toBe('Unnamed Discount');
    });

    it('should return empty array when no billing codes exist', async () => {
      // Arrange
      vi.mocked(mockBillingCodeRepo.getAll).mockResolvedValue([]);

      // Act
      const result = await billingCodeService.getBillingCodes();

      // Assert
      expect(mockBillingCodeRepo.getAll).toHaveBeenCalled();
      expect(mockSquareRepo.getCatalogByIds).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe('getBillingCodeById', () => {
    it('should return billing code with discount and organization details', async () => {
      // Arrange
      const mockCode = {
        billingCode: {
          id: 'code-123',
          code: 'TESTCODE',
          description: 'Test code',
          organizationId: 'org-123',
          discountId: 'discount-123',
        },
        organization: {
          id: 'org-123',
          name: 'Test Organization',
          email: 'org@test.com',
          archived: false,
        },
      };

      const mockCatalog: CatalogObject[] = [
        {
          type: 'DISCOUNT',
          id: 'discount-123',
          discountData: {
            name: 'Special Discount',
          },
        },
      ];

      vi.mocked(mockBillingCodeRepo.getById).mockResolvedValue(mockCode);
      vi.mocked(mockSquareRepo.getCatalogByIds).mockResolvedValue({
        objects: mockCatalog,
      });

      // Act
      const result = await billingCodeService.getBillingCodeById('code-123');

      // Assert
      expect(mockBillingCodeRepo.getById).toHaveBeenCalledWith('code-123');
      expect(mockSquareRepo.getCatalogByIds).toHaveBeenCalledWith(['discount-123']);
      expect(result).toEqual({
        id: 'code-123',
        code: 'TESTCODE',
        description: 'Test code',
        organizationId: 'org-123',
        discountId: 'discount-123',
        organizationName: 'Test Organization',
        discountName: 'Special Discount',
      });
    });

    it('should return billing code without discount name when no discount exists', async () => {
      // Arrange
      const mockCode = {
        billingCode: {
          id: 'code-456',
          code: 'NODISCOUNT',
          description: 'Code without discount',
          organizationId: 'org-456',
          discountId: null,
        },
        organization: {
          id: 'org-456',
          name: 'Another Org',
          email: 'another@test.com',
          archived: false,
        },
      };

      vi.mocked(mockBillingCodeRepo.getById).mockResolvedValue(mockCode);

      // Act
      const result = await billingCodeService.getBillingCodeById('code-456');

      // Assert
      expect(mockBillingCodeRepo.getById).toHaveBeenCalledWith('code-456');
      expect(mockSquareRepo.getCatalogByIds).not.toHaveBeenCalled();
      expect(result.discountName).toBeNull();
    });

    it('should throw error when billing code not found', async () => {
      // Arrange
      vi.mocked(mockBillingCodeRepo.getById).mockResolvedValue(null);

      // Act & Assert
      await expect(billingCodeService.getBillingCodeById('nonexistent')).rejects.toThrow(
        'Billing code not found',
      );
    });
  });

  describe('getBillingCodeByCode', () => {
    it('should return billing code when found by code string', async () => {
      // Arrange
      const mockCode = {
        billingCode: {
          id: 'code-789',
          code: 'FINDME',
          description: 'Find me code',
          organizationId: 'org-789',
          discountId: 'discount-789',
        },
        organization: {
          id: 'org-789',
          name: 'Find Org',
          email: 'find@test.com',
          archived: false,
        },
      };

      const mockCatalog: CatalogObject[] = [
        {
          type: 'DISCOUNT',
          id: 'discount-789',
          discountData: {
            name: 'Found Discount',
          },
        },
      ];

      vi.mocked(mockBillingCodeRepo.getByCode).mockResolvedValue(mockCode);
      vi.mocked(mockSquareRepo.getCatalogByIds).mockResolvedValue({
        objects: mockCatalog,
      });

      // Act
      const result = await billingCodeService.getBillingCodeByCode('FINDME');

      // Assert
      expect(mockBillingCodeRepo.getByCode).toHaveBeenCalledWith('FINDME');
      expect(result).toEqual({
        id: 'code-789',
        code: 'FINDME',
        description: 'Find me code',
        organizationId: 'org-789',
        discountId: 'discount-789',
        organizationName: 'Find Org',
        discountName: 'Found Discount',
      });
    });

    it('should return null when billing code not found', async () => {
      // Arrange
      vi.mocked(mockBillingCodeRepo.getByCode).mockResolvedValue(null);

      // Act
      const result = await billingCodeService.getBillingCodeByCode('NOTFOUND');

      // Assert
      expect(mockBillingCodeRepo.getByCode).toHaveBeenCalledWith('NOTFOUND');
      expect(result).toBeNull();
    });

    it('should return billing code without organization when organization is null', async () => {
      // Arrange
      const mockCode = {
        billingCode: {
          id: 'code-999',
          code: 'NOORG',
          description: 'No org code',
          organizationId: null,
          discountId: 'discount-999',
        },
        organization: null,
      };

      const mockCatalog: CatalogObject[] = [
        {
          type: 'DISCOUNT',
          id: 'discount-999',
          discountData: {
            name: 'No Org Discount',
          },
        },
      ];

      vi.mocked(mockBillingCodeRepo.getByCode).mockResolvedValue(mockCode);
      vi.mocked(mockSquareRepo.getCatalogByIds).mockResolvedValue({
        objects: mockCatalog,
      });

      // Act
      const result = await billingCodeService.getBillingCodeByCode('NOORG');

      // Assert
      expect(result?.organizationName).toBeNull();
      expect(result?.discountName).toBe('No Org Discount');
    });
  });

  describe('createBillingCode', () => {
    it('should create a new billing code', async () => {
      // Arrange
      const dto: CreateBillingCodeDto = {
        code: 'NEWCODE',
        description: 'New billing code',
        organizationId: 'org-new',
        discountId: 'discount-new',
      };

      const mockCreated = {
        id: 'code-new',
        code: 'NEWCODE',
        description: 'New billing code',
        organizationId: 'org-new',
        discountId: 'discount-new',
      };

      vi.mocked(mockBillingCodeRepo.create).mockResolvedValue(mockCreated);

      // Act
      const result = await billingCodeService.createBillingCode(dto);

      // Assert
      expect(mockBillingCodeRepo.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockCreated);
    });

    it('should create billing code with only discountId', async () => {
      // Arrange
      const dto: CreateBillingCodeDto = {
        code: 'SIMPLE',
        description: 'Simple code',
        discountId: '1234',
      };

      const mockCreated = {
        id: 'code-simple',
        code: 'SIMPLE',
        description: 'Simple code',
        organizationId: null,
        discountId: null,
      };

      vi.mocked(mockBillingCodeRepo.create).mockResolvedValue(mockCreated);

      // Act
      const result = await billingCodeService.createBillingCode(dto);

      // Assert
      expect(mockBillingCodeRepo.create).toHaveBeenCalledWith(dto);
      expect(result.organizationId).toBeNull();
      expect(result.discountId).toBeNull();
    });

    it('should create billing code with only organizationId', async () => {
      // Arrange
      const dto: CreateBillingCodeDto = {
        code: 'SIMPLE',
        description: 'Simple code',
        organizationId: 'org-123',
      };

      const mockCreated = {
        id: 'code-simple',
        code: 'SIMPLE',
        description: 'Simple code',
        organizationId: null,
        discountId: null,
      };

      vi.mocked(mockBillingCodeRepo.create).mockResolvedValue(mockCreated);

      // Act
      const result = await billingCodeService.createBillingCode(dto);

      // Assert
      expect(mockBillingCodeRepo.create).toHaveBeenCalledWith(dto);
      expect(result.organizationId).toBeNull();
      expect(result.discountId).toBeNull();
    });

    it('should throw error when neither organizationId nor discountId is provided', async () => {
      // Arrange
      const dto: CreateBillingCodeDto = {
        code: 'INVALID',
        description: 'Invalid code',
      };

      // Act & Assert
      await expect(billingCodeService.createBillingCode(dto)).rejects.toThrow(
        'Either discountId or organizationId must be provided',
      );
    });
  });

  describe('updateBillingCode', () => {
    it('should update an existing billing code', async () => {
      // Arrange
      const updates: Omit<UpdateBillingCodeDto, 'id'> = {
        description: 'Updated description',
        organizationId: 'org-updated',
        discountId: 'discount-updated',
      };

      const mockUpdated = {
        id: 'code-update',
        code: 'UPDATEME',
        description: 'Updated description',
        organizationId: 'org-updated',
        discountId: 'discount-updated',
      };

      vi.mocked(mockBillingCodeRepo.update).mockResolvedValue(mockUpdated);

      // Act
      const result = await billingCodeService.updateBillingCode('code-update', updates);

      // Assert
      expect(mockBillingCodeRepo.update).toHaveBeenCalledWith('code-update', updates);
      expect(result).toEqual(mockUpdated);
    });

    it('should update billing code to remove organization and discount', async () => {
      // Arrange
      const updates: Omit<UpdateBillingCodeDto, 'id'> = {
        description: 'No longer has org',
      };

      const mockUpdated = {
        id: 'code-remove',
        code: 'REMOVE',
        description: 'No longer has org',
        organizationId: null,
        discountId: null,
      };

      vi.mocked(mockBillingCodeRepo.update).mockResolvedValue(mockUpdated);

      // Act
      const result = await billingCodeService.updateBillingCode('code-remove', updates);

      // Assert
      expect(result.organizationId).toBeNull();
      expect(result.discountId).toBeNull();
    });
  });

  describe('deleteBillingCode', () => {
    it('should delete a billing code', async () => {
      // Arrange
      vi.mocked(mockBillingCodeRepo.delete).mockResolvedValue(undefined);

      // Act
      await billingCodeService.deleteBillingCode('code-delete');

      // Assert
      expect(mockBillingCodeRepo.delete).toHaveBeenCalledWith('code-delete');
    });

    it('should complete deletion even if code does not exist', async () => {
      // Arrange
      vi.mocked(mockBillingCodeRepo.delete).mockResolvedValue(undefined);

      // Act
      await billingCodeService.deleteBillingCode('nonexistent');

      // Assert
      expect(mockBillingCodeRepo.delete).toHaveBeenCalledWith('nonexistent');
    });
  });

  describe('Archived billing codes', () => {
    it('should only return non-archived billing codes in getAll', async () => {
      // Arrange - repository should handle filtering
      const mockCodes = [
        {
          billingCode: {
            id: 'code-1',
            code: 'ACTIVE1',
            description: 'Active code 1',
            organizationId: null,
            discountId: null,
            archived: false,
          },
          organization: null,
        },
        {
          billingCode: {
            id: 'code-2',
            code: 'ACTIVE2',
            description: 'Active code 2',
            organizationId: null,
            discountId: null,
            archived: false,
          },
          organization: null,
        },
      ];

      vi.mocked(mockBillingCodeRepo.getAll).mockResolvedValue(mockCodes);

      // Act
      const result = await billingCodeService.getBillingCodes();

      // Assert
      expect(result).toHaveLength(2);
      expect(result.every((code) => code.archived === false)).toBe(true);
    });

    it('should be able to retrieve archived billing codes by ID', async () => {
      // Arrange - getById should work even for archived codes
      const mockCode = {
        billingCode: {
          id: 'code-archived',
          code: 'ARCHIVED',
          description: 'Archived code',
          organizationId: null,
          discountId: null,
          archived: true,
        },
        organization: null,
      };

      vi.mocked(mockBillingCodeRepo.getById).mockResolvedValue(mockCode);

      // Act
      const result = await billingCodeService.getBillingCodeById('code-archived');

      // Assert
      expect(result.id).toBe('code-archived');
      expect(result.archived).toBe(true);
    });

    it('should be able to retrieve archived billing codes by code string', async () => {
      // Arrange - getByCode should work even for archived codes
      const mockCode = {
        billingCode: {
          id: 'code-old',
          code: 'OLDCODE',
          description: 'Old archived code',
          organizationId: 'org-1',
          discountId: null,
          archived: true,
        },
        organization: {
          id: 'org-1',
          name: 'Test Org',
          email: 'test@org.com',
          archived: false,
        },
      };

      vi.mocked(mockBillingCodeRepo.getByCode).mockResolvedValue(mockCode);

      // Act
      const result = await billingCodeService.getBillingCodeByCode('OLDCODE');

      // Assert
      expect(result?.code).toBe('OLDCODE');
      expect(result?.archived).toBe(true);
      expect(result?.organizationName).toBe('Test Org');
    });
  });
});
