import type { CreatePaymentDto } from '$lib/remotes/dtos/print_payment.dto';
import type { PrintRequestDto } from '$lib/remotes/dtos/print_request.dto';
import { DateTime } from 'luxon';
import type { CatalogObject, Customer, Invoice, Order } from 'square';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrintPaymentService } from './print_payment.service';

// Mock squareService singleton
vi.mock('./square.service', () => ({
  squareService: {
    checkActiveMember: vi.fn(),
    getLocations: vi.fn(),
    getCatalog: vi.fn(),
  },
}));

// Mock remote endpoints to avoid SvelteKit request store errors
vi.mock('$lib/remotes/endpoints/print_payment.remote', () => ({
  getPayment: vi.fn(() => ({
    refresh: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('$lib/remotes/endpoints/print_request.remote', () => ({
  getPrintRequests: vi.fn(() => ({
    refresh: vi.fn().mockResolvedValue(undefined),
  })),
  getPrintRequestById: vi.fn(() => ({
    refresh: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe('PrintPaymentService', () => {
  let printPaymentService: PrintPaymentService;
  let mockPaymentRepo: any;
  let mockRequestRepo: any;
  let mockSettingsRepo: any;
  let mockSquareRepo: any;
  let squareServiceMock: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockPaymentRepo = {
      getById: vi.fn(),
      createInvoice: vi.fn(),
      savePayment: vi.fn(),
      updatePayment: vi.fn(),
    };

    mockRequestRepo = {
      getById: vi.fn(),
      update: vi.fn(),
    };

    mockSettingsRepo = {
      getSetting: vi.fn(),
    };

    mockSquareRepo = {
      getCatalogByIds: vi.fn(),
      upsertCustomer: vi.fn(),
      createOrder: vi.fn(),
      sendInvoice: vi.fn(),
      cancelInvoice: vi.fn(),
      calculateOrder: vi.fn(),
    };

    printPaymentService = new PrintPaymentService(
      undefined,
      undefined,
      mockRequestRepo,
      mockPaymentRepo,
      mockSettingsRepo,
      mockSquareRepo,
    );

    const { squareService } = await import('./square.service');
    squareServiceMock = squareService;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getById', () => {
    it('should return payment by id', async () => {
      // Arrange
      const paymentId = 'payment-123';
      const mockPayment = {
        id: paymentId,
        requestId: 'request-456',
        status: 'pending',
        total: 5000,
        squareInvoiceId: 'inv-789',
        squareOrderId: 'order-789',
        issuedDate: DateTime.now(),
      };

      vi.mocked(mockPaymentRepo.getById).mockResolvedValue(mockPayment);

      // Act
      const result = await printPaymentService.getById(paymentId);

      // Assert
      expect(mockPaymentRepo.getById).toHaveBeenCalledWith(paymentId);
      expect(result).toEqual(mockPayment);
    });

    it('should return null when payment not found', async () => {
      // Arrange
      const paymentId = 'nonexistent-payment';
      vi.mocked(mockPaymentRepo.getById).mockResolvedValue(null);

      // Act
      const result = await printPaymentService.getById(paymentId);

      // Assert
      expect(mockPaymentRepo.getById).toHaveBeenCalledWith(paymentId);
      expect(result).toBeNull();
    });
  });

  describe('getPricingInfo', () => {
    it('should return pricing info for non-member', async () => {
      // Arrange
      const customerEmail = 'user@example.com';
      const mockSquareSettings = {
        locationId: 'loc-123',
        printRequestItemId: 'item-123',
        additionalBuildPlateItemId: 'plate-456',
        memberPrintDiscountId: 'discount-789',
      };

      const mockBuildPlateItem: CatalogObject = {
        type: 'ITEM_VARIATION',
        id: 'plate-456',
        itemVariationData: {
          priceMoney: {
            amount: BigInt(1000),
            currency: 'USD',
          },
        },
      };

      const mockMemberDiscount: CatalogObject = {
        type: 'DISCOUNT',
        id: 'discount-789',
        discountData: {
          percentage: '10',
        },
      };

      vi.mocked(mockSettingsRepo.getSetting).mockResolvedValue(mockSquareSettings);
      vi.mocked(mockSquareRepo.getCatalogByIds).mockResolvedValue({
        objects: [mockBuildPlateItem, mockMemberDiscount],
      });
      vi.mocked(squareServiceMock.checkActiveMember).mockResolvedValue(false);

      // Act
      const result = await printPaymentService.getPricingInfo(customerEmail);

      // Assert
      expect(mockSettingsRepo.getSetting).toHaveBeenCalledWith('printRequestSquare');
      expect(mockSquareRepo.getCatalogByIds).toHaveBeenCalledWith(['plate-456', 'discount-789']);
      expect(squareServiceMock.checkActiveMember).toHaveBeenCalledWith(customerEmail);
      expect(result).toEqual({
        additionalBuildPlateModifier: 1000,
        memberPrintDiscount: 10,
        memberDiscountApplied: false,
      });
    });

    it('should return pricing info for active member', async () => {
      // Arrange
      const customerEmail = 'member@example.com';
      const mockSquareSettings = {
        locationId: 'loc-123',
        printRequestItemId: 'item-123',
        additionalBuildPlateItemId: 'plate-456',
        memberPrintDiscountId: 'discount-789',
      };

      const mockBuildPlateItem: CatalogObject = {
        type: 'ITEM_VARIATION',
        id: 'plate-456',
        itemVariationData: {
          priceMoney: {
            amount: BigInt(1500),
            currency: 'USD',
          },
        },
      };

      const mockMemberDiscount: CatalogObject = {
        type: 'DISCOUNT',
        id: 'discount-789',
        discountData: {
          percentage: '15',
        },
      };

      vi.mocked(mockSettingsRepo.getSetting).mockResolvedValue(mockSquareSettings);
      vi.mocked(mockSquareRepo.getCatalogByIds).mockResolvedValue({
        objects: [mockBuildPlateItem, mockMemberDiscount],
      });
      vi.mocked(squareServiceMock.checkActiveMember).mockResolvedValue(true);

      // Act
      const result = await printPaymentService.getPricingInfo(customerEmail);

      // Assert
      expect(result.memberDiscountApplied).toBe(true);
      expect(result.additionalBuildPlateModifier).toBe(1500);
      expect(result.memberPrintDiscount).toBe(15);
    });
  });

  describe('upsertPayment', () => {
    it('should create new payment when no existing payment exists', async () => {
      // Arrange
      const dto: CreatePaymentDto = {
        requestId: 'request-123',
        materialCost: 5000,
        buildPlates: 2,
      };

      const mockRequest: PrintRequestDto = {
        id: 'request-123',
        customerName: 'John Doe',
        email: 'john@example.com',
        projectName: 'Test Project',
        status: 'in_queue',
        isQuote: false,
        paymentId: null,
        submissionDate: DateTime.now(),
      } as PrintRequestDto;

      const mockCustomer: Customer = {
        id: 'customer-123',
        emailAddress: 'john@example.com',
        givenName: 'John',
        familyName: 'Doe',
      };

      const mockOrder: Order = {
        id: 'order-123',
        locationId: 'loc-123',
        netAmountDueMoney: { amount: BigInt(6500), currency: 'USD' },
      };

      const mockInvoice: Invoice = {
        id: 'inv-123',
        version: 1,
        createdAt: DateTime.now().toISO(),
      };

      const mockPayment = {
        id: 'payment-123',
        requestId: 'request-123',
        status: 'pending',
        total: 6500,
        squareInvoiceId: 'inv-123',
        squareOrderId: 'order-123',
        issuedDate: DateTime.fromISO(mockInvoice.createdAt!),
      };

      const mockSquareSettings = {
        locationId: 'loc-123',
        printRequestItemId: 'item-123',
        additionalBuildPlateItemId: 'plate-456',
        memberPrintDiscountId: 'discount-789',
      };

      vi.mocked(mockRequestRepo.getById).mockResolvedValue(mockRequest);
      vi.mocked(mockPaymentRepo.getById).mockResolvedValue(null);
      vi.mocked(mockSettingsRepo.getSetting).mockResolvedValue(mockSquareSettings);
      vi.mocked(squareServiceMock.checkActiveMember).mockResolvedValue(false);
      vi.mocked(mockSquareRepo.upsertCustomer).mockResolvedValue(mockCustomer);
      vi.mocked(mockSquareRepo.createOrder).mockResolvedValue(mockOrder);
      vi.mocked(mockPaymentRepo.createInvoice).mockResolvedValue(mockInvoice);
      vi.mocked(mockSquareRepo.sendInvoice).mockResolvedValue(undefined);
      vi.mocked(mockPaymentRepo.savePayment).mockResolvedValue(mockPayment);
      vi.mocked(mockRequestRepo.update).mockResolvedValue(mockRequest);

      // Act
      const result = await printPaymentService.upsertPayment(dto);

      // Assert
      expect(mockRequestRepo.getById).toHaveBeenCalledWith('request-123');
      expect(mockPaymentRepo.getById).not.toHaveBeenCalled();
      expect(mockSquareRepo.upsertCustomer).toHaveBeenCalledWith('John Doe', 'john@example.com');
      expect(mockSquareRepo.createOrder).toHaveBeenCalled();
      expect(mockPaymentRepo.createInvoice).toHaveBeenCalledWith(mockOrder);
      expect(mockSquareRepo.sendInvoice).toHaveBeenCalledWith('inv-123', 1);
      expect(mockPaymentRepo.savePayment).toHaveBeenCalled();
      expect(result).toEqual(mockPayment);
    });

    it('should cancel existing invoice before creating new one', async () => {
      // Arrange
      const dto: CreatePaymentDto = {
        requestId: 'request-123',
        materialCost: 7000,
        buildPlates: 1,
      };

      const existingPayment = {
        id: 'payment-old',
        squareInvoiceId: 'inv-old',
        squareOrderId: 'order-old',
      };

      const mockRequest: PrintRequestDto = {
        id: 'request-123',
        customerName: 'Jane Smith',
        email: 'jane@example.com',
        projectName: 'Update Project',
        status: 'in_queue',
        isQuote: false,
        paymentId: 'payment-old',
        payment: existingPayment,
        submissionDate: DateTime.now(),
      } as PrintRequestDto;

      const mockCustomer: Customer = {
        id: 'customer-456',
        emailAddress: 'jane@example.com',
      };

      const mockOrder: Order = {
        id: 'order-new',
        locationId: 'loc-123',
        netAmountDueMoney: { amount: BigInt(7000), currency: 'USD' },
      };

      const mockInvoice: Invoice = {
        id: 'inv-new',
        version: 1,
        createdAt: DateTime.now().toISO(),
      };

      const mockNewPayment = {
        id: 'payment-new',
        requestId: 'request-123',
        squareInvoiceId: 'inv-new',
        squareOrderId: 'order-new',
      };

      const mockSquareSettings = {
        locationId: 'loc-123',
        printRequestItemId: 'item-123',
        additionalBuildPlateItemId: 'plate-456',
        memberPrintDiscountId: 'discount-789',
      };

      vi.mocked(mockRequestRepo.getById).mockResolvedValue(mockRequest);
      vi.mocked(mockSquareRepo.cancelInvoice).mockResolvedValue(undefined);
      vi.mocked(mockSettingsRepo.getSetting).mockResolvedValue(mockSquareSettings);
      vi.mocked(squareServiceMock.checkActiveMember).mockResolvedValue(false);
      vi.mocked(mockSquareRepo.upsertCustomer).mockResolvedValue(mockCustomer);
      vi.mocked(mockSquareRepo.createOrder).mockResolvedValue(mockOrder);
      vi.mocked(mockPaymentRepo.createInvoice).mockResolvedValue(mockInvoice);
      vi.mocked(mockSquareRepo.sendInvoice).mockResolvedValue(undefined);
      vi.mocked(mockPaymentRepo.savePayment).mockResolvedValue(mockNewPayment);
      vi.mocked(mockRequestRepo.update).mockResolvedValue(mockRequest);

      // Act
      const result = await printPaymentService.upsertPayment(dto);

      // Assert
      expect(mockSquareRepo.cancelInvoice).toHaveBeenCalledWith('inv-old');
      expect(result).toEqual(mockNewPayment);
    });

    it('should throw error when print request not found', async () => {
      // Arrange
      const dto: CreatePaymentDto = {
        requestId: 'nonexistent-request',
        materialCost: 5000,
        buildPlates: 1,
      };

      vi.mocked(mockRequestRepo.getById).mockResolvedValue(null);

      // Act & Assert
      await expect(printPaymentService.upsertPayment(dto)).rejects.toThrow(
        'Print request not found',
      );
      expect(mockRequestRepo.getById).toHaveBeenCalledWith('nonexistent-request');
    });

    it('should throw error when order creation fails', async () => {
      // Arrange
      const dto: CreatePaymentDto = {
        requestId: 'request-123',
        materialCost: 5000,
        buildPlates: 1,
      };

      const mockRequest: PrintRequestDto = {
        id: 'request-123',
        customerName: 'John Doe',
        email: 'john@example.com',
        status: 'in_queue',
        isQuote: false,
        paymentId: null,
      } as PrintRequestDto;

      const mockCustomer: Customer = {
        id: 'customer-123',
        emailAddress: 'john@example.com',
      };

      const mockSquareSettings = {
        locationId: 'loc-123',
        printRequestItemId: 'item-123',
        additionalBuildPlateItemId: 'plate-456',
        memberPrintDiscountId: 'discount-789',
      };

      vi.mocked(mockRequestRepo.getById).mockResolvedValue(mockRequest);
      vi.mocked(mockPaymentRepo.getById).mockResolvedValue(null);
      vi.mocked(mockSettingsRepo.getSetting).mockResolvedValue(mockSquareSettings);
      vi.mocked(squareServiceMock.checkActiveMember).mockResolvedValue(false);
      vi.mocked(mockSquareRepo.upsertCustomer).mockResolvedValue(mockCustomer);
      vi.mocked(mockSquareRepo.createOrder).mockResolvedValue(null);

      // Act & Assert
      await expect(printPaymentService.upsertPayment(dto)).rejects.toThrow(
        'Failed to create order in Square',
      );
    });

    it('should throw error when invoice creation fails', async () => {
      // Arrange
      const dto: CreatePaymentDto = {
        requestId: 'request-123',
        materialCost: 5000,
        buildPlates: 1,
      };

      const mockRequest: PrintRequestDto = {
        id: 'request-123',
        customerName: 'John Doe',
        email: 'john@example.com',
        status: 'in_queue',
        isQuote: false,
        paymentId: null,
      } as PrintRequestDto;

      const mockCustomer: Customer = {
        id: 'customer-123',
        emailAddress: 'john@example.com',
      };

      const mockOrder: Order = {
        id: 'order-123',
        locationId: 'loc-123',
        netAmountDueMoney: { amount: BigInt(5000), currency: 'USD' },
      };

      const mockSquareSettings = {
        locationId: 'loc-123',
        printRequestItemId: 'item-123',
        additionalBuildPlateItemId: 'plate-456',
        memberPrintDiscountId: 'discount-789',
      };

      vi.mocked(mockRequestRepo.getById).mockResolvedValue(mockRequest);
      vi.mocked(mockPaymentRepo.getById).mockResolvedValue(null);
      vi.mocked(mockSettingsRepo.getSetting).mockResolvedValue(mockSquareSettings);
      vi.mocked(squareServiceMock.checkActiveMember).mockResolvedValue(false);
      vi.mocked(mockSquareRepo.upsertCustomer).mockResolvedValue(mockCustomer);
      vi.mocked(mockSquareRepo.createOrder).mockResolvedValue(mockOrder);
      vi.mocked(mockPaymentRepo.createInvoice).mockResolvedValue(null);

      // Act & Assert
      await expect(printPaymentService.upsertPayment(dto)).rejects.toThrow(
        'Failed to create invoice in Square',
      );
    });

    it('should not send invoice for quote requests', async () => {
      // Arrange
      const dto: CreatePaymentDto = {
        requestId: 'request-quote',
        materialCost: 8000,
        buildPlates: 3,
      };

      const mockRequest: PrintRequestDto = {
        id: 'request-quote',
        customerName: 'Quote Customer',
        email: 'quote@example.com',
        status: 'in_queue',
        isQuote: true,
        paymentId: null,
      } as PrintRequestDto;

      const mockCustomer: Customer = {
        id: 'customer-quote',
        emailAddress: 'quote@example.com',
      };

      const mockOrder: Order = {
        id: 'order-quote',
        locationId: 'loc-123',
        netAmountDueMoney: { amount: BigInt(8000), currency: 'USD' },
      };

      const mockInvoice: Invoice = {
        id: 'inv-quote',
        version: 1,
        createdAt: DateTime.now().toISO(),
      };

      const mockPayment = {
        id: 'payment-quote',
        requestId: 'request-quote',
        squareInvoiceId: 'inv-quote',
      };

      const mockSquareSettings = {
        locationId: 'loc-123',
        printRequestItemId: 'item-123',
        additionalBuildPlateItemId: 'plate-456',
        memberPrintDiscountId: 'discount-789',
      };

      vi.mocked(mockRequestRepo.getById).mockResolvedValue(mockRequest);
      vi.mocked(mockSettingsRepo.getSetting).mockResolvedValue(mockSquareSettings);
      vi.mocked(squareServiceMock.checkActiveMember).mockResolvedValue(false);
      vi.mocked(mockSquareRepo.upsertCustomer).mockResolvedValue(mockCustomer);
      vi.mocked(mockSquareRepo.calculateOrder).mockResolvedValue(mockOrder);
      vi.mocked(mockPaymentRepo.savePayment).mockResolvedValue(mockPayment);
      vi.mocked(mockRequestRepo.update).mockResolvedValue(mockRequest);

      // Mock mailgun repository
      const mockMailgunRepo = {
        sendTemplate: vi.fn().mockResolvedValue(undefined),
      };
      (printPaymentService as any).mailgunRepository = mockMailgunRepo;

      // Act
      await printPaymentService.upsertPayment(dto);

      // Assert
      expect(mockSquareRepo.calculateOrder).toHaveBeenCalled();
      expect(mockSquareRepo.createOrder).not.toHaveBeenCalled();
      expect(mockSquareRepo.sendInvoice).not.toHaveBeenCalled();
      expect(mockMailgunRepo.sendTemplate).toHaveBeenCalled();
    });

    it('should include member discount for active members', async () => {
      // Arrange
      const dto: CreatePaymentDto = {
        requestId: 'request-member',
        materialCost: 10000,
        buildPlates: 1,
      };

      const mockRequest: PrintRequestDto = {
        id: 'request-member',
        customerName: 'Member User',
        email: 'member@example.com',
        status: 'in_queue',
        isQuote: false,
        paymentId: null,
      } as PrintRequestDto;

      const mockCustomer: Customer = {
        id: 'customer-member',
        emailAddress: 'member@example.com',
      };

      const mockOrder: Order = {
        id: 'order-member',
        locationId: 'loc-123',
        netAmountDueMoney: { amount: BigInt(9000), currency: 'USD' },
      };

      const mockInvoice: Invoice = {
        id: 'inv-member',
        version: 1,
        createdAt: DateTime.now().toISO(),
      };

      const mockPayment = {
        id: 'payment-member',
        requestId: 'request-member',
      };

      const mockSquareSettings = {
        locationId: 'loc-123',
        printRequestItemId: 'item-123',
        additionalBuildPlateItemId: 'plate-456',
        memberPrintDiscountId: 'discount-789',
      };

      vi.mocked(mockRequestRepo.getById).mockResolvedValue(mockRequest);
      vi.mocked(mockPaymentRepo.getById).mockResolvedValue(null);
      vi.mocked(mockSettingsRepo.getSetting).mockResolvedValue(mockSquareSettings);
      vi.mocked(squareServiceMock.checkActiveMember).mockResolvedValue(true);
      vi.mocked(mockSquareRepo.upsertCustomer).mockResolvedValue(mockCustomer);
      vi.mocked(mockSquareRepo.createOrder).mockResolvedValue(mockOrder);
      vi.mocked(mockPaymentRepo.createInvoice).mockResolvedValue(mockInvoice);
      vi.mocked(mockSquareRepo.sendInvoice).mockResolvedValue(undefined);
      vi.mocked(mockPaymentRepo.savePayment).mockResolvedValue(mockPayment);
      vi.mocked(mockRequestRepo.update).mockResolvedValue(mockRequest);

      // Act
      await printPaymentService.upsertPayment(dto);

      // Assert
      expect(squareServiceMock.checkActiveMember).toHaveBeenCalledWith('member@example.com');
      const orderCall = vi.mocked(mockSquareRepo.createOrder).mock.calls[0][0];
      expect(orderCall.order.discounts).toHaveLength(1);
      expect(orderCall.order.discounts[0].catalogObjectId).toBe('discount-789');
    });

    it('should add additional build plates to order', async () => {
      // Arrange
      const dto: CreatePaymentDto = {
        requestId: 'request-plates',
        materialCost: 5000,
        buildPlates: 3,
      };

      const mockRequest: PrintRequestDto = {
        id: 'request-plates',
        customerName: 'Multi Plate User',
        email: 'plates@example.com',
        status: 'in_queue',
        isQuote: false,
        paymentId: null,
      } as PrintRequestDto;

      const mockCustomer: Customer = {
        id: 'customer-plates',
        emailAddress: 'plates@example.com',
      };

      const mockOrder: Order = {
        id: 'order-plates',
        locationId: 'loc-123',
        netAmountDueMoney: { amount: BigInt(7000), currency: 'USD' },
      };

      const mockInvoice: Invoice = {
        id: 'inv-plates',
        version: 1,
        createdAt: DateTime.now().toISO(),
      };

      const mockPayment = {
        id: 'payment-plates',
        requestId: 'request-plates',
      };

      const mockSquareSettings = {
        locationId: 'loc-123',
        printRequestItemId: 'item-123',
        additionalBuildPlateItemId: 'plate-456',
        memberPrintDiscountId: 'discount-789',
      };

      vi.mocked(mockRequestRepo.getById).mockResolvedValue(mockRequest);
      vi.mocked(mockPaymentRepo.getById).mockResolvedValue(null);
      vi.mocked(mockSettingsRepo.getSetting).mockResolvedValue(mockSquareSettings);
      vi.mocked(squareServiceMock.checkActiveMember).mockResolvedValue(false);
      vi.mocked(mockSquareRepo.upsertCustomer).mockResolvedValue(mockCustomer);
      vi.mocked(mockSquareRepo.createOrder).mockResolvedValue(mockOrder);
      vi.mocked(mockPaymentRepo.createInvoice).mockResolvedValue(mockInvoice);
      vi.mocked(mockSquareRepo.sendInvoice).mockResolvedValue(undefined);
      vi.mocked(mockPaymentRepo.savePayment).mockResolvedValue(mockPayment);
      vi.mocked(mockRequestRepo.update).mockResolvedValue(mockRequest);

      // Act
      await printPaymentService.upsertPayment(dto);

      // Assert
      const orderCall = vi.mocked(mockSquareRepo.createOrder).mock.calls[0][0];
      expect(orderCall.order.lineItems).toHaveLength(2);
      expect(orderCall.order.lineItems[0].basePriceMoney?.amount).toBe(BigInt(5000));
      expect(orderCall.order.lineItems[1].catalogObjectId).toBe('plate-456');
      expect(orderCall.order.lineItems[1].quantity).toBe('2');
    });

    it('should update print request with material cost and buildplate count', async () => {
      // Arrange
      const dto: CreatePaymentDto = {
        requestId: 'request-update',
        materialCost: 6500,
        buildPlates: 2,
      };

      const mockRequest: PrintRequestDto = {
        id: 'request-update',
        customerName: 'Update User',
        email: 'update@example.com',
        status: 'in_queue',
        isQuote: false,
        paymentId: null,
      } as PrintRequestDto;

      const mockCustomer: Customer = {
        id: 'customer-update',
        emailAddress: 'update@example.com',
      };

      const mockOrder: Order = {
        id: 'order-update',
        locationId: 'loc-123',
        netAmountDueMoney: { amount: BigInt(6500), currency: 'USD' },
      };

      const mockInvoice: Invoice = {
        id: 'inv-update',
        version: 1,
        createdAt: DateTime.now().toISO(),
      };

      const mockPayment = {
        id: 'payment-update',
        requestId: 'request-update',
      };

      const mockSquareSettings = {
        locationId: 'loc-123',
        printRequestItemId: 'item-123',
        additionalBuildPlateItemId: 'plate-456',
        memberPrintDiscountId: 'discount-789',
      };

      vi.mocked(mockRequestRepo.getById).mockResolvedValue(mockRequest);
      vi.mocked(mockPaymentRepo.getById).mockResolvedValue(null);
      vi.mocked(mockSettingsRepo.getSetting).mockResolvedValue(mockSquareSettings);
      vi.mocked(squareServiceMock.checkActiveMember).mockResolvedValue(false);
      vi.mocked(mockSquareRepo.upsertCustomer).mockResolvedValue(mockCustomer);
      vi.mocked(mockSquareRepo.createOrder).mockResolvedValue(mockOrder);
      vi.mocked(mockPaymentRepo.createInvoice).mockResolvedValue(mockInvoice);
      vi.mocked(mockSquareRepo.sendInvoice).mockResolvedValue(undefined);
      vi.mocked(mockPaymentRepo.savePayment).mockResolvedValue(mockPayment);
      vi.mocked(mockRequestRepo.update).mockResolvedValue(mockRequest);

      // Act
      await printPaymentService.upsertPayment(dto);

      // Assert
      expect(mockRequestRepo.update).toHaveBeenCalledWith('request-update', {
        materialCost: 6500,
        buildplateCount: 2,
      });
    });
  });

  describe('getPrintRequestQuote', () => {
    it('should return quote when status is quote', async () => {
      // Arrange
      const requestId = 'request-quote-123';
      const mockRequest: PrintRequestDto = {
        id: requestId,
        customerName: 'Quote Customer',
        email: 'quote@example.com',
        projectName: 'Quote Project',
        status: 'in_queue',
        isQuote: true,
        payment: {
          id: 'payment-quote',
          status: 'quote',
          total: 5000,
        },
        submissionDate: DateTime.now(),
      } as PrintRequestDto;

      vi.mocked(mockRequestRepo.getById).mockResolvedValue(mockRequest);

      // Act
      const result = await printPaymentService.getPrintRequestQuote(requestId);

      // Assert
      expect(mockRequestRepo.getById).toHaveBeenCalledWith(requestId);
      expect(result).toEqual(mockRequest);
      expect(result.payment?.status).toBe('quote');
    });

    it('should throw error when payment status is not quote', async () => {
      // Arrange
      const requestId = 'request-not-quote';
      const mockRequest: PrintRequestDto = {
        id: requestId,
        payment: {
          id: 'payment-pending',
          status: 'pending',
        },
      } as PrintRequestDto;

      vi.mocked(mockRequestRepo.getById).mockResolvedValue(mockRequest);

      // Act & Assert
      await expect(printPaymentService.getPrintRequestQuote(requestId)).rejects.toThrow(
        'Print request is not in quote status',
      );
    });

    it('should throw error when payment is null', async () => {
      // Arrange
      const requestId = 'request-no-payment';
      const mockRequest: PrintRequestDto = {
        id: requestId,
        payment: null,
      } as PrintRequestDto;

      vi.mocked(mockRequestRepo.getById).mockResolvedValue(mockRequest);

      // Act & Assert
      await expect(printPaymentService.getPrintRequestQuote(requestId)).rejects.toThrow(
        'Print request is not in quote status',
      );
    });
  });

  describe('respondToQuote', () => {
    it.skip('should cancel request when quote is declined', async () => {
      // Arrange
      const dto = {
        id: 'request-decline',
        approve: false,
      };

      const mockRequest: PrintRequestDto = {
        id: dto.id,
        customerName: 'Decline Customer',
        email: 'decline@example.com',
        isQuote: true,
        payment: {
          id: 'payment-quote',
          status: 'quote',
        },
      } as PrintRequestDto;

      const mockUpdated = [{ id: dto.id, status: 'canceled' }];

      vi.mocked(mockRequestRepo.getById).mockResolvedValue(mockRequest);
      vi.mocked(mockRequestRepo.update).mockResolvedValue(mockUpdated);

      // Import the service singleton
      const { printRequestService } = await import('./print_request.service');
      vi.spyOn(printRequestService, 'updatePrintRequestStatus').mockResolvedValue(
        mockUpdated as any,
      );

      // Act
      const result = await printPaymentService.respondToQuote(dto);

      // Assert
      expect(mockRequestRepo.getById).toHaveBeenCalledWith(dto.id);
      expect(printRequestService.updatePrintRequestStatus).toHaveBeenCalledWith(dto.id, {
        status: 'canceled',
      });
      expect(result).toEqual({ status: 'canceled' });
    });

    it.skip('should create order when quote is approved', async () => {
      // Arrange
      const dto = {
        id: 'request-approve',
        approve: true,
      };

      const mockRequest: PrintRequestDto = {
        id: dto.id,
        customerName: 'Approve Customer',
        email: 'approve@example.com',
        isQuote: true,
        materialCost: 5000,
        buildplateCount: 2,
        payment: {
          id: 'payment-quote',
          status: 'quote',
        },
      } as PrintRequestDto;

      const mockCustomer: Customer = {
        id: 'customer-approve',
        emailAddress: 'approve@example.com',
      };

      const mockOrder: Order = {
        id: 'order-approve',
        locationId: 'loc-123',
        netAmountDueMoney: { amount: BigInt(5000), currency: 'USD' },
      };

      const mockInvoice: Invoice = {
        id: 'inv-approve',
        version: 1,
        createdAt: DateTime.now().toISO(),
      };

      const mockPayment = {
        id: 'payment-new',
        requestId: dto.id,
        status: 'pending',
      };

      const mockSquareSettings = {
        locationId: 'loc-123',
        printRequestItemId: 'item-123',
        additionalBuildPlateItemId: 'plate-456',
        memberPrintDiscountId: 'discount-789',
      };

      vi.mocked(mockRequestRepo.getById).mockResolvedValue(mockRequest);
      vi.mocked(mockSettingsRepo.getSetting).mockResolvedValue(mockSquareSettings);
      vi.mocked(squareServiceMock.checkActiveMember).mockResolvedValue(false);
      vi.mocked(mockSquareRepo.upsertCustomer).mockResolvedValue(mockCustomer);
      vi.mocked(mockSquareRepo.createOrder).mockResolvedValue(mockOrder);
      vi.mocked(mockPaymentRepo.createInvoice).mockResolvedValue(mockInvoice);
      vi.mocked(mockSquareRepo.sendInvoice).mockResolvedValue(undefined);
      vi.mocked(mockPaymentRepo.savePayment).mockResolvedValue(mockPayment);
      vi.mocked(mockRequestRepo.update).mockResolvedValue(mockRequest);

      // Act
      const result = await printPaymentService.respondToQuote(dto);

      // Assert
      expect(mockRequestRepo.getById).toHaveBeenCalledWith(dto.id);
      expect(mockSquareRepo.createOrder).toHaveBeenCalled();
      expect(mockSquareRepo.sendInvoice).toHaveBeenCalled();
      expect(result).toEqual(mockPayment);
    });

    it('should throw error when request not found', async () => {
      // Arrange
      const dto = {
        id: 'nonexistent',
        approve: true,
      };

      vi.mocked(mockRequestRepo.getById).mockResolvedValue(null);

      // Act & Assert
      await expect(printPaymentService.respondToQuote(dto)).rejects.toThrow(
        'Print request not found',
      );
    });

    it('should throw error when request is not a quote', async () => {
      // Arrange
      const dto = {
        id: 'request-not-quote',
        approve: true,
      };

      const mockRequest: PrintRequestDto = {
        id: dto.id,
        isQuote: false,
        payment: {
          status: 'pending',
        },
      } as PrintRequestDto;

      vi.mocked(mockRequestRepo.getById).mockResolvedValue(mockRequest);

      // Act & Assert
      await expect(printPaymentService.respondToQuote(dto)).rejects.toThrow(
        'Print request is not a quote',
      );
    });

    it('should throw error when payment status is not quote', async () => {
      // Arrange
      const dto = {
        id: 'request-wrong-status',
        approve: true,
      };

      const mockRequest: PrintRequestDto = {
        id: dto.id,
        isQuote: true,
        payment: {
          status: 'paid',
        },
      } as PrintRequestDto;

      vi.mocked(mockRequestRepo.getById).mockResolvedValue(mockRequest);

      // Act & Assert
      await expect(printPaymentService.respondToQuote(dto)).rejects.toThrow(
        'Print request is not a quote',
      );
    });
  });

  describe('upsertQuote', () => {
    it('should create quote without sending invoice', async () => {
      // Arrange
      const dto: CreatePaymentDto = {
        requestId: 'request-new-quote',
        materialCost: 8000,
        buildPlates: 3,
      };

      const mockRequest: PrintRequestDto = {
        id: 'request-new-quote',
        customerName: 'New Quote Customer',
        email: 'newquote@example.com',
        projectName: 'New Quote Project',
        status: 'in_queue',
        isQuote: true,
        paymentId: null,
        submissionDate: DateTime.now(),
      } as PrintRequestDto;

      const mockCustomer: Customer = {
        id: 'customer-newquote',
        emailAddress: 'newquote@example.com',
      };

      const mockCalculatedOrder: Order = {
        id: 'order-quote-new',
        locationId: 'loc-123',
        netAmountDueMoney: { amount: BigInt(9000), currency: 'USD' },
      };

      const mockPayment = {
        id: 'payment-quote-new',
        requestId: 'request-new-quote',
        status: 'quote',
        total: 9000,
      };

      const mockSquareSettings = {
        locationId: 'loc-123',
        printRequestItemId: 'item-123',
        additionalBuildPlateItemId: 'plate-456',
        memberPrintDiscountId: 'discount-789',
      };

      vi.mocked(mockRequestRepo.getById).mockResolvedValue(mockRequest);
      vi.mocked(mockSettingsRepo.getSetting).mockResolvedValue(mockSquareSettings);
      vi.mocked(squareServiceMock.checkActiveMember).mockResolvedValue(false);
      vi.mocked(mockSquareRepo.upsertCustomer).mockResolvedValue(mockCustomer);
      vi.mocked(mockSquareRepo.calculateOrder).mockResolvedValue(mockCalculatedOrder);
      vi.mocked(mockPaymentRepo.savePayment).mockResolvedValue(mockPayment);
      vi.mocked(mockRequestRepo.update).mockResolvedValue(mockRequest);

      // Mock mailgun repository
      const mockMailgunRepo = {
        sendTemplate: vi.fn().mockResolvedValue(undefined),
      };
      (printPaymentService as any).mailgunRepository = mockMailgunRepo;

      // Act
      const result = await printPaymentService.upsertPayment(dto);

      // Assert
      expect(mockSquareRepo.calculateOrder).toHaveBeenCalled();
      expect(mockSquareRepo.createOrder).not.toHaveBeenCalled();
      expect(mockSquareRepo.sendInvoice).not.toHaveBeenCalled();
      expect(mockMailgunRepo.sendTemplate).toHaveBeenCalled();
      expect(result.status).toBe('quote');
    });
  });
});
