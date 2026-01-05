import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock fetch globally
global.fetch = vi.fn();

vi.mock('$lib/server/repositories/print_files.repository', () => {
  const MockPrintFilesRepository = vi.fn();
  MockPrintFilesRepository.prototype.getByPrintRequestId = vi.fn();
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

describe('PrintFilesService', () => {
  let printFilesService: any;
  let mockFilesRepo: any;

  beforeEach(async () => {
    // Clear all mocks
    vi.clearAllMocks();

    // Import the service
    const { printFilesService: service } = await import('$lib/server/services/print_files.service');
    printFilesService = service;

    // Get reference to the repository mock
    const { PrintFilesRepository } =
      await import('$lib/server/repositories/print_files.repository');
    mockFilesRepo = PrintFilesRepository.prototype;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getByRequestId', () => {
    it('should call repository with correct print request ID', async () => {
      // Arrange
      const printRequestId = 'request-123';
      const mockFiles = [
        {
          id: 'file-1',
          printRequestId: 'request-123',
          fileName: 'model1.stl',
          fileUrl: 'https://s3.example.com/file1.stl',
          quantity: 2,
        },
        {
          id: 'file-2',
          printRequestId: 'request-123',
          fileName: 'model2.stl',
          fileUrl: 'https://s3.example.com/file2.stl',
          quantity: 1,
        },
      ];

      vi.mocked(mockFilesRepo.getByPrintRequestId).mockResolvedValue(mockFiles);

      // Act
      const result = await printFilesService.getByRequestId(printRequestId);

      // Assert
      expect(mockFilesRepo.getByPrintRequestId).toHaveBeenCalledWith(printRequestId);
      expect(mockFilesRepo.getByPrintRequestId).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockFiles);
    });

    it('should return empty array when no files exist for request', async () => {
      // Arrange
      const printRequestId = 'request-456';
      vi.mocked(mockFilesRepo.getByPrintRequestId).mockResolvedValue([]);

      // Act
      const result = await printFilesService.getByRequestId(printRequestId);

      // Assert
      expect(mockFilesRepo.getByPrintRequestId).toHaveBeenCalledWith(printRequestId);
      expect(result).toEqual([]);
    });

    it('should handle different request IDs correctly', async () => {
      // Arrange
      const requestId1 = 'request-111';
      const requestId2 = 'request-222';

      const mockFiles1 = [{ id: 'file-1', printRequestId: requestId1, fileName: 'part1.stl' }];
      const mockFiles2 = [{ id: 'file-2', printRequestId: requestId2, fileName: 'part2.stl' }];

      vi.mocked(mockFilesRepo.getByPrintRequestId)
        .mockResolvedValueOnce(mockFiles1)
        .mockResolvedValueOnce(mockFiles2);

      // Act
      const result1 = await printFilesService.getByRequestId(requestId1);
      const result2 = await printFilesService.getByRequestId(requestId2);

      // Assert
      expect(mockFilesRepo.getByPrintRequestId).toHaveBeenNthCalledWith(1, requestId1);
      expect(mockFilesRepo.getByPrintRequestId).toHaveBeenNthCalledWith(2, requestId2);
      expect(result1).toEqual(mockFiles1);
      expect(result2).toEqual(mockFiles2);
    });

    it('should return multiple files with different quantities', async () => {
      // Arrange
      const printRequestId = 'request-789';
      const mockFiles = [
        {
          id: 'file-1',
          printRequestId: 'request-789',
          fileName: 'gear.stl',
          fileUrl: 'https://s3.example.com/gear.stl',
          quantity: 5,
        },
        {
          id: 'file-2',
          printRequestId: 'request-789',
          fileName: 'housing.stl',
          fileUrl: 'https://s3.example.com/housing.stl',
          quantity: 1,
        },
        {
          id: 'file-3',
          printRequestId: 'request-789',
          fileName: 'bracket.stl',
          fileUrl: 'https://s3.example.com/bracket.stl',
          quantity: 3,
        },
      ];

      vi.mocked(mockFilesRepo.getByPrintRequestId).mockResolvedValue(mockFiles);

      // Act
      const result = await printFilesService.getByRequestId(printRequestId);

      // Assert
      expect(result).toHaveLength(3);
      expect(result[0].quantity).toBe(5);
      expect(result[1].quantity).toBe(1);
      expect(result[2].quantity).toBe(3);
    });
  });

  describe('downloadRequestZIP', () => {
    it('should fetch files and create a zip blob', async () => {
      // Arrange
      const printRequestId = 'request-abc';
      const mockFiles = [
        {
          id: 'file-1',
          printRequestId: 'request-abc',
          fileName: 'model.stl',
          fileUrl: 'https://s3.example.com/model.stl',
          quantity: 1,
        },
      ];

      const mockFileContent = new ArrayBuffer(8);
      const mockResponse = {
        arrayBuffer: vi.fn().mockResolvedValue(mockFileContent),
      };

      vi.mocked(mockFilesRepo.getByPrintRequestId).mockResolvedValue(mockFiles);
      vi.mocked(global.fetch).mockResolvedValue(mockResponse as any);

      // Act
      const result = await printFilesService.downloadRequestZIP(printRequestId);

      // Assert
      expect(mockFilesRepo.getByPrintRequestId).toHaveBeenCalledWith(printRequestId);
      expect(global.fetch).toHaveBeenCalledWith('https://s3.example.com/model.stl');
      expect(result).toBeInstanceOf(Blob);
    });

    it('should create zip with multiple files', async () => {
      // Arrange
      const printRequestId = 'request-multi';
      const mockFiles = [
        {
          id: 'file-1',
          printRequestId: 'request-multi',
          fileName: 'part1.stl',
          fileUrl: 'https://s3.example.com/part1.stl',
          quantity: 1,
        },
        {
          id: 'file-2',
          printRequestId: 'request-multi',
          fileName: 'part2.stl',
          fileUrl: 'https://s3.example.com/part2.stl',
          quantity: 2,
        },
      ];

      const mockFileContent = new ArrayBuffer(8);
      const mockResponse = {
        arrayBuffer: vi.fn().mockResolvedValue(mockFileContent),
      };

      vi.mocked(mockFilesRepo.getByPrintRequestId).mockResolvedValue(mockFiles);
      vi.mocked(global.fetch).mockResolvedValue(mockResponse as any);

      // Act
      const result = await printFilesService.downloadRequestZIP(printRequestId);

      // Assert
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(global.fetch).toHaveBeenCalledWith('https://s3.example.com/part1.stl');
      expect(global.fetch).toHaveBeenCalledWith('https://s3.example.com/part2.stl');
      expect(result).toBeInstanceOf(Blob);
    });

    it('should handle empty file list', async () => {
      // Arrange
      const printRequestId = 'request-empty';
      vi.mocked(mockFilesRepo.getByPrintRequestId).mockResolvedValue([]);

      // Act
      const result = await printFilesService.downloadRequestZIP(printRequestId);

      // Assert
      expect(mockFilesRepo.getByPrintRequestId).toHaveBeenCalledWith(printRequestId);
      expect(global.fetch).not.toHaveBeenCalled();
      expect(result).toBeInstanceOf(Blob);
    });

    it('should fetch each file URL correctly', async () => {
      // Arrange
      const printRequestId = 'request-urls';
      const mockFiles = [
        {
          id: 'file-1',
          printRequestId: 'request-urls',
          fileName: 'design.stl',
          fileUrl: 'https://bucket.s3.amazonaws.com/designs/file1.stl',
          quantity: 3,
        },
      ];

      const mockFileContent = new ArrayBuffer(16);
      const mockResponse = {
        arrayBuffer: vi.fn().mockResolvedValue(mockFileContent),
      };

      vi.mocked(mockFilesRepo.getByPrintRequestId).mockResolvedValue(mockFiles);
      vi.mocked(global.fetch).mockResolvedValue(mockResponse as any);

      // Act
      await printFilesService.downloadRequestZIP(printRequestId);

      // Assert
      expect(global.fetch).toHaveBeenCalledWith(
        'https://bucket.s3.amazonaws.com/designs/file1.stl',
      );
    });

    it('should handle file download errors gracefully', async () => {
      // Arrange
      const printRequestId = 'request-error';
      const mockFiles = [
        {
          id: 'file-1',
          printRequestId: 'request-error',
          fileName: 'broken.stl',
          fileUrl: 'https://s3.example.com/broken.stl',
          quantity: 1,
        },
      ];

      vi.mocked(mockFilesRepo.getByPrintRequestId).mockResolvedValue(mockFiles);
      vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'));

      // Act & Assert
      await expect(printFilesService.downloadRequestZIP(printRequestId)).rejects.toThrow(
        'Network error',
      );
    });

    it('should handle concurrent downloads with limit', async () => {
      // Arrange
      const printRequestId = 'request-concurrent';
      const mockFiles = Array.from({ length: 10 }, (_, i) => ({
        id: `file-${i}`,
        printRequestId: 'request-concurrent',
        fileName: `part${i}.stl`,
        fileUrl: `https://s3.example.com/part${i}.stl`,
        quantity: 1,
      }));

      const mockFileContent = new ArrayBuffer(8);
      const mockResponse = {
        arrayBuffer: vi.fn().mockResolvedValue(mockFileContent),
      };

      vi.mocked(mockFilesRepo.getByPrintRequestId).mockResolvedValue(mockFiles);
      vi.mocked(global.fetch).mockResolvedValue(mockResponse as any);

      // Act
      const result = await printFilesService.downloadRequestZIP(printRequestId);

      // Assert
      expect(global.fetch).toHaveBeenCalledTimes(10);
      expect(result).toBeInstanceOf(Blob);
    });
  });
});
