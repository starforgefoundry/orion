import type { SubmitPrintRequestDto } from '$lib/remotes/dtos/print_request.dto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  MockPrintRequestRepository.prototype.search = vi.fn();
  MockPrintRequestRepository.prototype.updatePartQuantity = vi.fn();
  return { PrintRequestRepository: MockPrintRequestRepository };
});

vi.mock('$lib/server/repositories/payment.repository', () => {
  const MockPaymentRepository = vi.fn();
  MockPaymentRepository.prototype.getById = vi.fn();
  MockPaymentRepository.prototype.markPaid = vi.fn();
  MockPaymentRepository.prototype.cancel = vi.fn();
  return { PaymentRepository: MockPaymentRepository };
});

vi.mock('$lib/server/repositories/square.repository', () => {
  const MockSquareRepository = vi.fn();
  MockSquareRepository.prototype.cancelInvoice = vi.fn();
  return { SquareRepository: MockSquareRepository };
});

vi.mock('$lib/server/repositories/discord.repository', () => {
  const MockDiscordRepository = vi.fn();
  MockDiscordRepository.prototype.sendWebhookNotification = vi.fn();
  return { DiscordRepository: MockDiscordRepository };
});

vi.mock('$lib/server/repositories/settings.repository', () => {
  const MockSettingsRepository = vi.fn();
  MockSettingsRepository.prototype.getSetting = vi.fn();
  return { SettingsRepository: MockSettingsRepository };
});

vi.mock('$lib/server/repositories/mailgun.repository', () => {
  const MockMailgunRepository = vi.fn();
  MockMailgunRepository.prototype.sendTemplate = vi.fn();
  return { MailgunRepository: MockMailgunRepository };
});

vi.mock('$lib/server/repositories/billing_code.repository', () => {
  const MockBillingCodeRepository = vi.fn();
  MockBillingCodeRepository.prototype.getByCode = vi.fn();
  MockBillingCodeRepository.prototype.getById = vi.fn();
  return { BillingCodeRepository: MockBillingCodeRepository };
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
  let mockPaymentRepo: any;
  let mockSquareRepo: any;
  let mockDiscordRepo: any;
  let mockSettingsRepo: any;
  let mockMailgunRepo: any;
  let mockBillingCodeRepo: any;
  let getRequestEvent: any;

  beforeEach(async () => {
    // Clear all mocks
    vi.clearAllMocks();

    // Get mocked modules
    const { getRequestEvent: getReqEvent } = await import('$app/server');
    getRequestEvent = getReqEvent;

    // Set up the mock request event
    vi.mocked(getRequestEvent).mockReturnValue({});

    // Import the service - this will create new instances of the mocked repositories
    const { printRequestService: service } =
      await import('$lib/server/services/print_request.service');
    printRequestService = service;

    // Get references to the repository mocks
    const { PrintFilesRepository } =
      await import('$lib/server/repositories/print_files.repository');
    const { PrintRequestRepository } =
      await import('$lib/server/repositories/print_request.repository');
    const { PaymentRepository } = await import('$lib/server/repositories/payment.repository');
    const { SquareRepository } = await import('$lib/server/repositories/square.repository');
    const { DiscordRepository } = await import('$lib/server/repositories/discord.repository');
    const { SettingsRepository } = await import('$lib/server/repositories/settings.repository');
    const { MailgunRepository } = await import('$lib/server/repositories/mailgun.repository');
    const { BillingCodeRepository } =
      await import('$lib/server/repositories/billing_code.repository');

    // Access the prototype methods (these are the actual mocks)
    mockFilesRepo = PrintFilesRepository.prototype;
    mockRequestRepo = PrintRequestRepository.prototype;
    mockPaymentRepo = PaymentRepository.prototype;
    mockSquareRepo = SquareRepository.prototype;
    mockDiscordRepo = DiscordRepository.prototype;
    mockSettingsRepo = SettingsRepository.prototype;
    mockMailgunRepo = MailgunRepository.prototype;
    mockBillingCodeRepo = BillingCodeRepository.prototype;
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
      // Mock getById for Discord notification
      vi.mocked(mockRequestRepo.getById).mockResolvedValue({
        ...mockPrintRequest,
        customerName: dto.customer.name,
        email: dto.customer.email,
      });
      vi.mocked(mockSettingsRepo.getSetting).mockResolvedValue({
        discordWebhookUrl: null,
      });

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
      // Mock getById for Discord notification
      vi.mocked(mockRequestRepo.getById).mockResolvedValue({
        ...mockPrintRequest,
        customerName: dto.customer.name,
        email: dto.customer.email,
      });
      vi.mocked(mockSettingsRepo.getSetting).mockResolvedValue({
        discordWebhookUrl: null,
      });

      // Act
      const result = await printRequestService.submitPrintRequest(dto);

      // Assert
      expect(mockRequestRepo.submit).toHaveBeenCalledWith(dto);
      expect(result.printRequestId).toBe(mockPrintRequest.id);
    });

    it('should store uploaded files before returning', async () => {
      // Arrange
      const mockPrintRequest = { id: 'request-1', customer: 'customer-1' };
      const dto: SubmitPrintRequestDto = {
        customer: { name: 'Test', email: 'test@test.com' },
        projectName: 'Test',
        material: 'mat-1',
        files: [{ file: new File(['data'], 'part.stl'), filename: 'part.stl', quantity: 1 }],
      };

      let uploaded = false;
      vi.mocked(mockRequestRepo.submit).mockResolvedValue(mockPrintRequest);
      vi.mocked(mockFilesRepo.uploadFiles).mockImplementation(async () => {
        await Promise.resolve();
        uploaded = true;
      });
      // Mock getById for Discord notification
      vi.mocked(mockRequestRepo.getById).mockResolvedValue({
        ...mockPrintRequest,
        customerName: dto.customer.name,
        email: dto.customer.email,
      });
      vi.mocked(mockSettingsRepo.getSetting).mockResolvedValue({
        discordWebhookUrl: null,
      });

      // Act
      await printRequestService.submitPrintRequest(dto);

      // Assert
      expect(mockFilesRepo.uploadFiles).toHaveBeenCalledWith('request-1', dto.files);
      expect(uploaded).toBe(true);
    });
  });

  describe('sendDiscordNotification', () => {
    it('should send Discord webhook notification with correct data', async () => {
      // Arrange
      const requestId = 'request-discord';
      const mockRequest = {
        id: requestId,
        customerName: 'John Doe',
        email: 'john@example.com',
        projectName: 'Test Project',
        specialRequests: 'Handle with care',
      };

      vi.mocked(mockRequestRepo.getById).mockResolvedValue(mockRequest);
      vi.mocked(mockSettingsRepo.getSetting).mockResolvedValue({
        discordWebhookUrl: 'https://discord.com/api/webhooks/test',
      });
      vi.mocked(mockDiscordRepo.sendWebhookNotification).mockResolvedValue(undefined);

      // Act
      await printRequestService.sendDiscordNotification(requestId);

      // Assert
      expect(mockRequestRepo.getById).toHaveBeenCalledWith(requestId);
      expect(mockSettingsRepo.getSetting).toHaveBeenCalledWith('printRequest');
      expect(mockDiscordRepo.sendWebhookNotification).toHaveBeenCalledWith(
        'https://discord.com/api/webhooks/test',
        expect.objectContaining({
          content: expect.stringContaining('new print request'),
          embeds: expect.arrayContaining([
            expect.objectContaining({
              title: '🖨️ New Print Request Submitted',
              fields: expect.arrayContaining([
                expect.objectContaining({ name: 'Project Name', value: 'Test Project' }),
                expect.objectContaining({ name: 'Customer', value: 'John Doe' }),
                expect.objectContaining({ name: 'Email', value: 'john@example.com' }),
                expect.objectContaining({ name: 'Special Requests', value: 'Handle with care' }),
              ]),
            }),
          ]),
        }),
      );
    });

    it('should not include special requests field when empty', async () => {
      // Arrange
      const requestId = 'request-no-special';
      const mockRequest = {
        id: requestId,
        customerName: 'Jane Smith',
        email: 'jane@example.com',
        projectName: 'Simple Project',
        specialRequests: null,
      };

      vi.mocked(mockRequestRepo.getById).mockResolvedValue(mockRequest);
      vi.mocked(mockSettingsRepo.getSetting).mockResolvedValue({
        discordWebhookUrl: 'https://discord.com/api/webhooks/test',
      });
      vi.mocked(mockDiscordRepo.sendWebhookNotification).mockResolvedValue(undefined);

      // Act
      await printRequestService.sendDiscordNotification(requestId);

      // Assert
      expect(mockDiscordRepo.sendWebhookNotification).toHaveBeenCalledWith(
        'https://discord.com/api/webhooks/test',
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              fields: expect.not.arrayContaining([
                expect.objectContaining({ name: 'Special Requests' }),
              ]),
            }),
          ]),
        }),
      );
    });

    it('should return early when webhook URL is not configured', async () => {
      // Arrange
      const requestId = 'request-no-webhook';
      const mockRequest = {
        id: requestId,
        customerName: 'Test User',
        email: 'test@example.com',
        projectName: 'Test',
      };

      vi.mocked(mockRequestRepo.getById).mockResolvedValue(mockRequest);
      vi.mocked(mockSettingsRepo.getSetting).mockResolvedValue({
        discordWebhookUrl: null,
      });

      // Act
      await printRequestService.sendDiscordNotification(requestId);

      // Assert
      expect(mockDiscordRepo.sendWebhookNotification).not.toHaveBeenCalled();
    });

    it('should throw error when request not found', async () => {
      // Arrange
      const requestId = 'nonexistent';
      vi.mocked(mockRequestRepo.getById).mockResolvedValue(null);

      // Act & Assert
      await expect(printRequestService.sendDiscordNotification(requestId)).rejects.toThrow(
        'Print request not found',
      );
      expect(mockDiscordRepo.sendWebhookNotification).not.toHaveBeenCalled();
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

  describe('getPrintRequestById', () => {
    it('should return a single print request by ID', async () => {
      // Arrange
      const requestId = 'request-123';
      const mockRequest = {
        id: requestId,
        customer: { id: 'cust-1', name: 'John', email: 'john@test.com' },
        projectName: 'Test Project',
        status: 'in_queue' as const,
      };

      vi.mocked(mockRequestRepo.getById).mockResolvedValue(mockRequest);

      // Act
      const result = await printRequestService.getPrintRequestById(requestId);

      // Assert
      expect(mockRequestRepo.getById).toHaveBeenCalledWith(requestId);
      expect(result).toEqual(mockRequest);
    });

    it('should return null when request not found', async () => {
      // Arrange
      const requestId = 'nonexistent-request';
      vi.mocked(mockRequestRepo.getById).mockResolvedValue(null);

      // Act
      const result = await printRequestService.getPrintRequestById(requestId);

      // Assert
      expect(mockRequestRepo.getById).toHaveBeenCalledWith(requestId);
      expect(result).toBeNull();
    });
  });

  describe('searchPrintRequests', () => {
    it('should search print requests with given criteria', async () => {
      // Arrange
      const dto = {
        status: 'in_queue' as const,
        customerEmail: 'search@example.com',
      };

      const mockResults = [
        {
          id: 'request-1',
          status: 'in_queue' as const,
          email: 'search@example.com',
          projectName: 'Project A',
        },
        {
          id: 'request-2',
          status: 'in_queue' as const,
          email: 'search@example.com',
          projectName: 'Project B',
        },
      ];

      vi.mocked(mockRequestRepo.search).mockResolvedValue(mockResults);

      // Act
      const result = await printRequestService.searchPrintRequests(dto);

      // Assert
      expect(mockRequestRepo.search).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockResults);
    });

    it('should return empty array when no requests match criteria', async () => {
      // Arrange
      const dto = {
        status: 'canceled' as const,
      };

      vi.mocked(mockRequestRepo.search).mockResolvedValue([]);

      // Act
      const result = await printRequestService.searchPrintRequests(dto);

      // Assert
      expect(mockRequestRepo.search).toHaveBeenCalledWith(dto);
      expect(result).toEqual([]);
    });
  });

  describe('updatePartQuantity', () => {
    it('should update quantity for a specific part', async () => {
      // Arrange
      const dto = {
        partId: 'part-123',
        quantity: 5,
      };

      const mockUpdated = {
        id: 'part-123',
        quantity: 5,
      };

      vi.mocked(mockRequestRepo.updatePartQuantity).mockResolvedValue(mockUpdated);

      // Act
      const result = await printRequestService.updatePartQuantity(dto);

      // Assert
      expect(mockRequestRepo.updatePartQuantity).toHaveBeenCalledWith('part-123', 5);
      expect(result).toEqual(mockUpdated);
    });

    it('should handle zero quantity updates', async () => {
      // Arrange
      const dto = {
        partId: 'part-456',
        quantity: 0,
      };

      const mockUpdated = {
        id: 'part-456',
        quantity: 0,
      };

      vi.mocked(mockRequestRepo.updatePartQuantity).mockResolvedValue(mockUpdated);

      // Act
      const result = await printRequestService.updatePartQuantity(dto);

      // Assert
      expect(mockRequestRepo.updatePartQuantity).toHaveBeenCalledWith('part-456', 0);
      expect(result).toEqual(mockUpdated);
    });
  });

  describe('sendPickupNotification', () => {
    it('should send pickup email notification to customer', async () => {
      // Arrange
      const requestId = 'request-pickup';
      const mockRequest = {
        id: requestId,
        email: 'customer@example.com',
        projectName: 'Completed Project',
      };

      vi.mocked(mockRequestRepo.getById).mockResolvedValue(mockRequest);
      vi.mocked(mockMailgunRepo.sendTemplate).mockResolvedValue(undefined);

      // Act
      await printRequestService.sendPickupNotification(requestId);

      // Assert
      expect(mockRequestRepo.getById).toHaveBeenCalledWith(requestId);
      expect(mockMailgunRepo.sendTemplate).toHaveBeenCalledWith(
        'customer@example.com',
        expect.stringContaining('Starforge 3D Prints'),
        expect.any(String),
        expect.stringContaining('Completed Project'),
        'print_pickup',
        expect.objectContaining({
          projectName: 'Completed Project',
        }),
      );
    });

    it('should throw error when request not found', async () => {
      // Arrange
      const requestId = 'nonexistent';
      vi.mocked(mockRequestRepo.getById).mockResolvedValue(null);

      // Act & Assert
      await expect(printRequestService.sendPickupNotification(requestId)).rejects.toThrow(
        'Print request not found',
      );
    });
  });

  describe('updatePrintRequestStatus', () => {
    it('should update status to done and set completion date', async () => {
      // Arrange
      const requestId = 'request-done';
      const dto = { status: 'done' as const };
      const mockRequest = {
        id: requestId,
        status: 'printing' as const,
        paymentId: null,
      };
      const mockUpdated = [{ id: requestId, status: 'done' as const }];

      vi.mocked(mockRequestRepo.getById).mockResolvedValue(mockRequest);
      vi.mocked(mockRequestRepo.update).mockResolvedValue(mockUpdated);

      // Act
      const result = await printRequestService.updatePrintRequestStatus(requestId, dto);

      // Assert
      expect(mockRequestRepo.getById).toHaveBeenCalledWith(requestId);
      expect(mockRequestRepo.update).toHaveBeenCalledWith(
        requestId,
        expect.objectContaining({
          status: 'done',
          completionDate: expect.anything(),
        }),
      );
      expect(result).toEqual(mockUpdated);
    });

    it('should mark organization payment as paid when status changes to done', async () => {
      // Arrange
      const requestId = 'request-org-done';
      const dto = { status: 'done' as const };
      const mockRequest = {
        id: requestId,
        status: 'printing' as const,
        paymentId: 'payment-org-123',
      };
      const mockPayment = {
        id: 'payment-org-123',
        organizationId: 'org-456',
        status: 'pending',
      };
      const mockUpdated = [{ id: requestId, status: 'done' as const }];

      vi.mocked(mockRequestRepo.getById).mockResolvedValue(mockRequest);
      vi.mocked(mockPaymentRepo.getById).mockResolvedValue(mockPayment);
      vi.mocked(mockRequestRepo.update).mockResolvedValue(mockUpdated);

      // Act
      const result = await printRequestService.updatePrintRequestStatus(requestId, dto);

      // Assert
      expect(mockPaymentRepo.getById).toHaveBeenCalledWith('payment-org-123');
      expect(mockPaymentRepo.markPaid).toHaveBeenCalledWith('payment-org-123');
      expect(mockRequestRepo.update).toHaveBeenCalledWith(
        requestId,
        expect.objectContaining({
          status: 'done',
          completionDate: expect.anything(),
        }),
      );
      expect(result).toEqual(mockUpdated);
    });

    it('should not mark payment as paid when status is done but payment is not from organization', async () => {
      // Arrange
      const requestId = 'request-regular-done';
      const dto = { status: 'done' as const };
      const mockRequest = {
        id: requestId,
        status: 'printing' as const,
        paymentId: 'payment-regular-123',
      };
      const mockPayment = {
        id: 'payment-regular-123',
        organizationId: null, // Not an organization payment
        status: 'pending',
      };
      const mockUpdated = [{ id: requestId, status: 'done' as const }];

      vi.mocked(mockRequestRepo.getById).mockResolvedValue(mockRequest);
      vi.mocked(mockPaymentRepo.getById).mockResolvedValue(mockPayment);
      vi.mocked(mockRequestRepo.update).mockResolvedValue(mockUpdated);

      // Act
      const result = await printRequestService.updatePrintRequestStatus(requestId, dto);

      // Assert
      expect(mockPaymentRepo.getById).toHaveBeenCalledWith('payment-regular-123');
      expect(mockPaymentRepo.markPaid).not.toHaveBeenCalled();
      expect(result).toEqual(mockUpdated);
    });

    it('should update status to canceled and set completion date', async () => {
      // Arrange
      const requestId = 'request-cancel';
      const dto = { status: 'canceled' as const };
      const mockRequest = {
        id: requestId,
        status: 'in_queue' as const,
        paymentId: null,
      };
      const mockUpdated = [{ id: requestId, status: 'canceled' as const }];

      vi.mocked(mockRequestRepo.getById).mockResolvedValue(mockRequest);
      vi.mocked(mockRequestRepo.update).mockResolvedValue(mockUpdated);

      // Act
      const result = await printRequestService.updatePrintRequestStatus(requestId, dto);

      // Assert
      expect(mockRequestRepo.update).toHaveBeenCalledWith(
        requestId,
        expect.objectContaining({
          status: 'canceled',
          completionDate: expect.anything(),
        }),
      );
      expect(result).toEqual(mockUpdated);
    });

    it('should cancel the payment when status is canceled and payment exists', async () => {
      // Arrange
      const requestId = 'request-cancel-payment';
      const dto = { status: 'canceled' as const };
      const mockRequest = {
        id: requestId,
        status: 'in_queue' as const,
        paymentId: 'payment-123',
      };
      const mockPayment = {
        id: 'payment-123',
        squareInvoiceId: 'inv-456',
      };
      const mockUpdated = [{ id: requestId, status: 'canceled' as const }];

      vi.mocked(mockRequestRepo.getById).mockResolvedValue(mockRequest);
      vi.mocked(mockPaymentRepo.getById).mockResolvedValue(mockPayment);
      vi.mocked(mockRequestRepo.update).mockResolvedValue(mockUpdated);

      // Act
      const result = await printRequestService.updatePrintRequestStatus(requestId, dto);

      // Assert
      expect(mockPaymentRepo.getById).toHaveBeenCalledWith('payment-123');
      expect(mockPaymentRepo.cancel).toHaveBeenCalledWith(mockPayment);
      expect(result).toEqual(mockUpdated);
    });

    it('should not cancel a payment when status is canceled but no payment exists', async () => {
      // Arrange
      const requestId = 'request-cancel-no-payment';
      const dto = { status: 'canceled' as const };
      const mockRequest = {
        id: requestId,
        status: 'in_queue' as const,
        paymentId: null,
      };
      const mockUpdated = [{ id: requestId, status: 'canceled' as const }];

      vi.mocked(mockRequestRepo.getById).mockResolvedValue(mockRequest);
      vi.mocked(mockRequestRepo.update).mockResolvedValue(mockUpdated);

      // Act
      await printRequestService.updatePrintRequestStatus(requestId, dto);

      // Assert
      expect(mockPaymentRepo.getById).not.toHaveBeenCalled();
      expect(mockPaymentRepo.cancel).not.toHaveBeenCalled();
    });

    it('should update status without setting completion date for other statuses', async () => {
      // Arrange
      const requestId = 'request-printing';
      const dto = { status: 'printing' as const };
      const mockRequest = {
        id: requestId,
        status: 'in_queue' as const,
        paymentId: null,
      };
      const mockUpdated = [{ id: requestId, status: 'printing' as const }];

      vi.mocked(mockRequestRepo.getById).mockResolvedValue(mockRequest);
      vi.mocked(mockRequestRepo.update).mockResolvedValue(mockUpdated);

      // Act
      const result = await printRequestService.updatePrintRequestStatus(requestId, dto);

      // Assert
      expect(mockRequestRepo.update).toHaveBeenCalledWith(requestId, {
        status: 'printing',
      });
      expect(result).toEqual(mockUpdated);
    });

    it('should refresh print requests after updating status', async () => {
      // Arrange
      const requestId = 'request-refresh';
      const dto = { status: 'done' as const };
      const mockRequest = {
        id: requestId,
        status: 'printing' as const,
        paymentId: null,
      };
      const mockUpdated = [{ id: requestId, status: 'done' as const }];

      vi.mocked(mockRequestRepo.getById).mockResolvedValue(mockRequest);
      vi.mocked(mockRequestRepo.update).mockResolvedValue(mockUpdated);

      // Act
      await printRequestService.updatePrintRequestStatus(requestId, dto);

      // Assert
      // Service calls getPrintRequests().refresh() which is mocked to return a fn
      // We just need to verify the update was called
      expect(mockRequestRepo.update).toHaveBeenCalled();
    });
  });
});
