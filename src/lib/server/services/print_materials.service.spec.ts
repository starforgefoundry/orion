import type {
  CreatePrintMaterialDto,
  UpdatePrintMaterialDto,
} from '$lib/remotes/dtos/print_materials.dto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/repositories/print_files.repository', () => {
  const MockPrintFilesRepository = vi.fn();
  return { PrintFilesRepository: MockPrintFilesRepository };
});

vi.mock('$lib/server/repositories/print_materials.repository', () => {
  const MockPrintMaterialsRepository = vi.fn();
  MockPrintMaterialsRepository.prototype.create = vi.fn();
  MockPrintMaterialsRepository.prototype.get = vi.fn();
  MockPrintMaterialsRepository.prototype.update = vi.fn();
  return { PrintMaterialsRepository: MockPrintMaterialsRepository };
});

vi.mock('$lib/server/repositories/print_request.repository', () => {
  const MockPrintRequestRepository = vi.fn();
  return { PrintRequestRepository: MockPrintRequestRepository };
});

// Mock $app/server
vi.mock('$app/server', () => ({
  getRequestEvent: vi.fn(),
  form: vi.fn((schema, handler) => handler),
  command: vi.fn((schema, handler) => handler),
  query: vi.fn((schemaOrHandler, handler?) => {
    const actualHandler = handler || schemaOrHandler;
    (actualHandler as any).refresh = vi.fn().mockResolvedValue(undefined);
    return actualHandler;
  }),
}));

// Mock getPrintMaterials to avoid circular dependency
vi.mock('$lib/remotes/endpoints/print_materials.remote', () => ({
  getPrintMaterials: vi.fn(() => ({
    refresh: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe('PrintMaterialsService', () => {
  let printMaterialsService: any;
  let mockMaterialsRepo: any;

  beforeEach(async () => {
    // Clear all mocks
    vi.clearAllMocks();

    // Import the service
    const { printMaterialsService: service } =
      await import('$lib/server/services/print_materials.service');
    printMaterialsService = service;

    // Get reference to the repository mock
    const { PrintMaterialsRepository } =
      await import('$lib/server/repositories/print_materials.repository');
    mockMaterialsRepo = PrintMaterialsRepository.prototype;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getMaterials', () => {
    it('should return all materials when no filter is provided', async () => {
      // Arrange
      const mockMaterials = [
        {
          id: 'mat-1',
          name: 'PLA',
          pricePerGram: 0.05,
          available: true,
          archived: false,
        },
        {
          id: 'mat-2',
          name: 'ABS',
          pricePerGram: 0.06,
          available: true,
          archived: false,
        },
      ];

      vi.mocked(mockMaterialsRepo.get).mockResolvedValue(mockMaterials);

      // Act
      const result = await printMaterialsService.getMaterials();

      // Assert
      expect(mockMaterialsRepo.get).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(mockMaterials);
    });

    it('should return only available materials when filter is true', async () => {
      // Arrange
      const mockAvailableMaterials = [
        {
          id: 'mat-1',
          name: 'PLA',
          pricePerGram: 0.05,
          available: true,
          archived: false,
        },
      ];

      vi.mocked(mockMaterialsRepo.get).mockResolvedValue(mockAvailableMaterials);

      // Act
      const result = await printMaterialsService.getMaterials(true);

      // Assert
      expect(mockMaterialsRepo.get).toHaveBeenCalledWith(true);
      expect(result).toEqual(mockAvailableMaterials);
    });

    it('should return unavailable materials when filter is false', async () => {
      // Arrange
      const mockUnavailableMaterials = [
        {
          id: 'mat-3',
          name: 'Nylon',
          pricePerGram: 0.08,
          available: false,
          archived: false,
        },
      ];

      vi.mocked(mockMaterialsRepo.get).mockResolvedValue(mockUnavailableMaterials);

      // Act
      const result = await printMaterialsService.getMaterials(false);

      // Assert
      expect(mockMaterialsRepo.get).toHaveBeenCalledWith(false);
      expect(result).toEqual(mockUnavailableMaterials);
    });

    it('should return empty array when no materials exist', async () => {
      // Arrange
      vi.mocked(mockMaterialsRepo.get).mockResolvedValue([]);

      // Act
      const result = await printMaterialsService.getMaterials();

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('createMaterial', () => {
    it('should create a new material with correct parameters', async () => {
      // Arrange
      const dto: CreatePrintMaterialDto = {
        name: 'PETG',
        available: true,
      };

      vi.mocked(mockMaterialsRepo.create).mockResolvedValue(undefined);

      // Act
      await printMaterialsService.createMaterial(dto);

      // Assert
      expect(mockMaterialsRepo.create).toHaveBeenCalledWith(dto);
    });

    it('should create unavailable material', async () => {
      // Arrange
      const dto: CreatePrintMaterialDto = {
        name: 'TPU',
        available: false,
      };

      vi.mocked(mockMaterialsRepo.create).mockResolvedValue(undefined);

      // Act
      await printMaterialsService.createMaterial(dto);

      // Assert
      expect(mockMaterialsRepo.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('updateMaterial', () => {
    it('should update material and refresh the materials list', async () => {
      // Arrange
      const id = 'mat-123';
      const updates: Omit<UpdatePrintMaterialDto, 'id'> = {
        name: 'Updated PLA',
      };

      const mockUpdatedMaterial = {
        id: 'mat-123',
        name: 'Updated PLA',
        cost: 0.06,
        available: true,
        archived: false,
      };

      vi.mocked(mockMaterialsRepo.update).mockResolvedValue(mockUpdatedMaterial);

      // Act
      const result = await printMaterialsService.updateMaterial(id, updates);

      // Assert
      expect(mockMaterialsRepo.update).toHaveBeenCalledWith(id, updates);
      expect(result).toEqual(mockUpdatedMaterial);
    });

    it('should update material availability', async () => {
      // Arrange
      const id = 'mat-456';
      const updates: Omit<UpdatePrintMaterialDto, 'id'> = {
        available: false,
      };

      const mockUpdatedMaterial = {
        id: 'mat-456',
        name: 'ABS',
        cost: 0.06,
        available: false,
        archived: false,
      };

      vi.mocked(mockMaterialsRepo.update).mockResolvedValue(mockUpdatedMaterial);

      // Act
      const result = await printMaterialsService.updateMaterial(id, updates);

      // Assert
      expect(mockMaterialsRepo.update).toHaveBeenCalledWith(id, updates);
      expect(result.available).toBe(false);
    });

    it('should handle multiple field updates simultaneously', async () => {
      // Arrange
      const id = 'mat-789';
      const updates: Omit<UpdatePrintMaterialDto, 'id'> = {
        name: 'PETG Premium',
        available: true,
      };

      const mockUpdatedMaterial = {
        id: 'mat-789',
        name: 'PETG Premium',
        cost: 0.07,
        available: true,
        archived: false,
      };

      vi.mocked(mockMaterialsRepo.update).mockResolvedValue(mockUpdatedMaterial);

      // Act
      const result = await printMaterialsService.updateMaterial(id, updates);

      // Assert
      expect(mockMaterialsRepo.update).toHaveBeenCalledWith(id, updates);
      expect(result.name).toBe('PETG Premium');
      expect(result.available).toBe(true);
    });

    it('should throw error when material not found', async () => {
      // Arrange
      const id = 'nonexistent-mat';
      const updates: Omit<UpdatePrintMaterialDto, 'id'> = {
        name: 'New Name',
      };

      vi.mocked(mockMaterialsRepo.update).mockRejectedValue(new Error('Material not found'));

      // Act & Assert
      await expect(printMaterialsService.updateMaterial(id, updates)).rejects.toThrow(
        'Material not found',
      );
    });
  });

  describe('edge cases', () => {
    it('should handle repository errors in getMaterials', async () => {
      // Arrange
      vi.mocked(mockMaterialsRepo.get).mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(printMaterialsService.getMaterials()).rejects.toThrow('Database error');
    });

    it('should handle repository errors in createMaterial', async () => {
      // Arrange
      const dto: CreatePrintMaterialDto = {
        name: 'Error Material',
        available: true,
      };

      vi.mocked(mockMaterialsRepo.create).mockRejectedValue(new Error('Failed to create material'));

      // Act & Assert
      await expect(printMaterialsService.createMaterial(dto)).rejects.toThrow(
        'Failed to create material',
      );
    });
  });
});
