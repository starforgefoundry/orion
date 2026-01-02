import type { SubmitPrintRequestDto } from '$lib/remotes/dtos/print_request.dto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockRequestEvent } from './test-utils';

// Mock the repositories
vi.mock('$lib/server/repositories/print_files.repository', () => {
  const MockPrintFilesRepository = vi.fn();
  MockPrintFilesRepository.prototype.uploadFiles = vi.fn();
  MockPrintFilesRepository.prototype.getByPrintRequestId = vi.fn();
  return { PrintFilesRepository: MockPrintFilesRepository };
});

vi.mock('$lib/server/repositories/print_materials.repository', () => {
  const MockPrintMaterialsRepository = vi.fn();
  return { PrintMaterialsRepository: MockPrintMaterialsRepository };
});

vi.mock('$lib/server/repositories/print_request.repository', () => {
  const MockPrintRequestRepository = vi.fn();
  MockPrintRequestRepository.prototype.submit = vi.fn();
  MockPrintRequestRepository.prototype.getAll = vi.fn();
  MockPrintRequestRepository.prototype.update = vi.fn();
  MockPrintRequestRepository.prototype.getById = vi.fn();
  return { PrintRequestRepository: MockPrintRequestRepository };
});

// Mock $app/server with all required exports
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

// Mock getPrintRequests to avoid circular dependency
vi.mock('$lib/remotes/endpoints/print_request.remote', () => ({
  getPrintRequests: vi.fn(() => ({
    refresh: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe('PrintRequestService', () => {
  let printRequestService: any;
  let mockCustomerRepo: any;
  let mockFilesRepo: any;
  let mockRequestRepo: any;
  let getRequestEvent: any;

  beforeEach(async () => {
    // Clear all mocks
    vi.clearAllMocks();

    // Get mocked modules
    const { getRequestEvent: getReqEvent } = await import('$app/server');
    getRequestEvent = getReqEvent;

    // Set up the mock request event
    vi.mocked(getRequestEvent).mockReturnValue(createMockRequestEvent());

    // Import the service - this will create new instances of the mocked repositories
    const { printRequestService: service } =
      await import('$lib/server/services/print_request.service');
    printRequestService = service;

    // Get references to the repository mocks
    const { PrintFilesRepository } =
      await import('$lib/server/repositories/print_files.repository');
    const { PrintRequestRepository } =
      await import('$lib/server/repositories/print_request.repository');

    // Access the prototype methods (these are the actual mocks)
    mockFilesRepo = PrintFilesRepository.prototype;
    mockRequestRepo = PrintRequestRepository.prototype;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('submitPrintRequest', () => {
    it('should create customer, submit request, and upload files with correct parameters', async () => {
      // Arrange

      const mockPrintRequest = {
        id: 'request-456',
        customer: 'customer-123',
        projectName: 'Test Project',
        specialRequests: '',
        isQuote: false,
        status: 'in_queue' as const,
        material: 'material-789',
        billingCode: null,
        submissionDate: new Date(),
      };

      const mockFile = new File(['test'], 'test.stl', { type: 'model/stl' });
      const dto: SubmitPrintRequestDto = {
        customer: {
          name: 'John Doe',
          email: 'john@example.com',
        },
        projectName: 'Test Project',
        specialRequests: '',
        isQuote: false,
        material: 'material-789',
        billingCode: '',
        files: [
          {
            file: mockFile,
            filename: 'test.stl',
            quantity: 1,
          },
        ],
      };

      vi.mocked(mockRequestRepo.submit).mockResolvedValue(mockPrintRequest);
      vi.mocked(mockFilesRepo.uploadFiles).mockResolvedValue(undefined);

      // Act
      const result = await printRequestService.submitPrintRequest(dto);

      // Assert
      expect(mockRequestRepo.submit).toHaveBeenCalledWith(dto);
      expect(mockFilesRepo.uploadFiles).toHaveBeenCalledWith(mockPrintRequest.id, dto.files);

      expect(result).toEqual({
        status: 'success',
        printRequestId: mockPrintRequest.id,
      });
    });

    it('should handle quote requests correctly', async () => {
      // Arrange

      const mockPrintRequest = {
        id: 'request-999',
        customer: 'customer-789',
        projectName: 'Quote Request',
        specialRequests: 'Please provide detailed quote',
        isQuote: true,
        status: 'in_queue' as const,
        material: 'material-456',
        billingCode: 'DEPT-001',
        submissionDate: new Date(),
      };

      const dto: SubmitPrintRequestDto = {
        customer: {
          name: 'Jane Smith',
          email: 'jane@example.com',
        },
        projectName: 'Quote Request',
        specialRequests: 'Please provide detailed quote',
        isQuote: true,
        material: 'material-456',
        billingCode: 'DEPT-001',
        files: [],
      };

      vi.mocked(mockRequestRepo.submit).mockResolvedValue(mockPrintRequest);
      vi.mocked(mockFilesRepo.uploadFiles).mockResolvedValue(undefined);

      // Act
      const result = await printRequestService.submitPrintRequest(dto);

      // Assert
      expect(mockRequestRepo.submit).toHaveBeenCalledWith(dto);
      expect(result.printRequestId).toBe(mockPrintRequest.id);
    });

    it('should use platform context waitUntil for file uploads', async () => {
      // Arrange
      const mockWaitUntil = vi.fn();
      vi.mocked(getRequestEvent).mockReturnValue({
        platform: {
          ctx: {
            waitUntil: mockWaitUntil,
          },
        },
      });

      const mockCustomer = { id: 'customer-1', name: 'Test', email: 'test@test.com' };
      const mockPrintRequest = { id: 'request-1', customer: 'customer-1' };
      const dto: SubmitPrintRequestDto = {
        customer: { name: 'Test', email: 'test@test.com' },
        projectName: 'Test',
        material: 'mat-1',
        files: [],
      };

      vi.mocked(mockRequestRepo.submit).mockResolvedValue(mockPrintRequest);
      vi.mocked(mockFilesRepo.uploadFiles).mockResolvedValue(undefined);

      // Act
      await printRequestService.submitPrintRequest(dto);

      // Assert
      expect(mockWaitUntil).toHaveBeenCalled();
    });
  });

  describe('getPrintRequests', () => {
    it('should return all print requests from repository', async () => {
      // Arrange
      const mockRequests = [
        {
          id: 'request-1',
          customer: { id: 'cust-1', name: 'John', email: 'john@test.com' },
          material: { id: 'mat-1', name: 'PLA', pricePerGram: 0.05 },
          projectName: 'Project 1',
          status: 'in_queue' as const,
          submissionDate: new Date(),
        },
        {
          id: 'request-2',
          customer: { id: 'cust-2', name: 'Jane', email: 'jane@test.com' },
          material: { id: 'mat-2', name: 'ABS', pricePerGram: 0.06 },
          projectName: 'Project 2',
          status: 'printing' as const,
          submissionDate: new Date(),
        },
      ];

      vi.mocked(mockRequestRepo.getAll).mockResolvedValue(mockRequests);

      // Act
      const result = await printRequestService.getPrintRequests();

      // Assert
      expect(mockRequestRepo.getAll).toHaveBeenCalled();
      expect(result).toEqual(mockRequests);
    });

    it('should return empty array when no requests exist', async () => {
      // Arrange
      vi.mocked(mockRequestRepo.getAll).mockResolvedValue([]);

      // Act
      const result = await printRequestService.getPrintRequests();

      // Assert
      expect(mockRequestRepo.getAll).toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe('updatePrintRequest', () => {
    it('should update request with provided fields and refresh list', async () => {
      // Arrange
      const id = 'request-123';
      const updates = {
        status: 'printing' as const,
        projectName: 'Updated Project',
      };

      const mockUpdatedRequest = [
        {
          id: 'request-123',
          status: 'printing' as const,
          projectName: 'Updated Project',
          customer: 'customer-456',
          material: 'material-789',
        },
      ];

      vi.mocked(mockRequestRepo.update).mockResolvedValue(mockUpdatedRequest);

      // Act
      const result = await printRequestService.updatePrintRequest(id, updates);

      // Assert
      expect(mockRequestRepo.update).toHaveBeenCalledWith(id, updates);
      expect(result).toEqual(mockUpdatedRequest);
    });

    it('should handle status-only updates', async () => {
      // Arrange
      const id = 'request-456';
      const updates = { status: 'done' as const };
      const mockUpdated = [{ id, status: 'done' as const }];

      vi.mocked(mockRequestRepo.update).mockResolvedValue(mockUpdated);

      // Act
      const result = await printRequestService.updatePrintRequest(id, updates);

      // Assert
      expect(mockRequestRepo.update).toHaveBeenCalledWith(id, updates);
      expect(result).toEqual(mockUpdated);
    });

    it('should handle billing code updates', async () => {
      // Arrange
      const id = 'request-789';
      const updates = { billingCode: 'NEW-CODE-123' };
      const mockUpdated = [{ id, billingCode: 'NEW-CODE-123' }];

      vi.mocked(mockRequestRepo.update).mockResolvedValue(mockUpdated);

      // Act
      const result = await printRequestService.updatePrintRequest(id, updates);

      // Assert
      expect(mockRequestRepo.update).toHaveBeenCalledWith(id, updates);
      expect(result).toEqual(mockUpdated);
    });
  });

  describe('getFilesByRequestId', () => {
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
      const result = await printRequestService.getFilesByRequestId(printRequestId);

      // Assert
      expect(mockFilesRepo.getByPrintRequestId).toHaveBeenCalledWith(printRequestId);
      expect(result).toEqual(mockFiles);
    });

    it('should return empty array when no files exist for request', async () => {
      // Arrange
      const printRequestId = 'request-456';
      vi.mocked(mockFilesRepo.getByPrintRequestId).mockResolvedValue([]);

      // Act
      const result = await printRequestService.getFilesByRequestId(printRequestId);

      // Assert
      expect(mockFilesRepo.getByPrintRequestId).toHaveBeenCalledWith(printRequestId);
      expect(result).toEqual([]);
    });

    it('should handle different request IDs correctly', async () => {
      // Arrange
      const requestId1 = 'request-111';
      const requestId2 = 'request-222';

      const mockFiles1 = [{ id: 'file-1', printRequestId: requestId1 }];
      const mockFiles2 = [{ id: 'file-2', printRequestId: requestId2 }];

      vi.mocked(mockFilesRepo.getByPrintRequestId)
        .mockResolvedValueOnce(mockFiles1)
        .mockResolvedValueOnce(mockFiles2);

      // Act
      const result1 = await printRequestService.getFilesByRequestId(requestId1);
      const result2 = await printRequestService.getFilesByRequestId(requestId2);

      // Assert
      expect(mockFilesRepo.getByPrintRequestId).toHaveBeenNthCalledWith(1, requestId1);
      expect(mockFilesRepo.getByPrintRequestId).toHaveBeenNthCalledWith(2, requestId2);
      expect(result1).toEqual(mockFiles1);
      expect(result2).toEqual(mockFiles2);
    });
  });
});
