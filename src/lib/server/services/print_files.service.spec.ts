import JSZip from 'jszip';
import { Readable } from 'node:stream';
import { buffer } from 'node:stream/consumers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/repositories/print_files.repository', () => {
  const MockPrintFilesRepository = vi.fn();
  MockPrintFilesRepository.prototype.getByPrintRequestId = vi.fn();
  MockPrintFilesRepository.prototype.openForRequest = vi.fn();
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
    function storedFile(fileName: string, contents: string) {
      return { fileName, size: contents.length, stream: Readable.from([Buffer.from(contents)]) };
    }

    async function unzip(zip: Readable) {
      return await JSZip.loadAsync(await buffer(zip));
    }

    it('should zip every stored file for the request', async () => {
      vi.mocked(mockFilesRepo.openForRequest).mockResolvedValue([
        storedFile('part1.stl', 'first'),
        storedFile('part2.stl', 'second'),
      ]);

      const archive = await unzip(await printFilesService.downloadRequestZIP('request-multi'));

      expect(mockFilesRepo.openForRequest).toHaveBeenCalledWith('request-multi');
      expect(await archive.file('part1.stl')?.async('string')).toBe('first');
      expect(await archive.file('part2.stl')?.async('string')).toBe('second');
    });

    it('should produce an empty archive when the request has no files', async () => {
      vi.mocked(mockFilesRepo.openForRequest).mockResolvedValue([]);

      const archive = await unzip(await printFilesService.downloadRequestZIP('request-empty'));

      expect(Object.keys(archive.files)).toHaveLength(0);
    });

    it('should propagate missing file errors', async () => {
      vi.mocked(mockFilesRepo.openForRequest).mockRejectedValue(new Error('ENOENT'));

      await expect(printFilesService.downloadRequestZIP('request-error')).rejects.toThrow('ENOENT');
    });
  });
});
