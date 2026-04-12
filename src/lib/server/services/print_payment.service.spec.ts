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
  let mockBillingCodeRepo: any;
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

    mockBillingCodeRepo = {
      getByCode: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      getAll: vi.fn(),
    };

    printPaymentService = new PrintPaymentService(
      undefined,
      undefined,
      mockRequestRepo,
      mockPaymentRepo,
      mockSettingsRepo,
      mockSquareRepo,
      undefined,
      undefined,
      undefined,
      mockBillingCodeRepo,
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
      expect(mockSquareRepo.getCatalogByIds).toHaveBeenCalledWith(['plate-456']);
      expect(squareServiceMock.checkActiveMember).toHaveBeenCalledWith(customerEmail);
      expect(result).toEqual({
        additionalBuildPlateModifier: 1000,
        discounts: [
          {
            id: 'discount-789',
            name: 'Unnamed Discount',
            percentage: 10,
          },
        ],
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
      expect(result.discounts).toStrictEqual([
        {
          id: 'discount-789',
          name: 'Unnamed Discount',
          percentage: 15,
        },
      ]);
      expect(result.additionalBuildPlateModifier).toBe(1500);
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

    it('should throw error when existing payment has already been paid', async () => {
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
        projectName: 'Test Project',
        status: 'in_queue',
        isQuote: false,
        paymentId: 'payment-123',
        payment: {
          id: 'payment-123',
          status: 'paid',
          total: 5000,
          issuedDate: DateTime.now(),
          paymentDate: DateTime.now(),
        },
        submissionDate: DateTime.now(),
      } as PrintRequestDto;

      vi.mocked(mockRequestRepo.getById).mockResolvedValue(mockRequest);

      // Act & Assert
      await expect(printPaymentService.upsertPayment(dto)).rejects.toThrow(
        'Payment has already been paid',
      );
      expect(mockRequestRepo.getById).toHaveBeenCalledWith('request-123');
      expect(mockSquareRepo.upsertCustomer).not.toHaveBeenCalled();
      expect(mockSquareRepo.createOrder).not.toHaveBeenCalled();
      expect(mockPaymentRepo.savePayment).not.toHaveBeenCalled();
    });

    it('should allow payment creation when existing payment is pending', async () => {
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
        projectName: 'Test Project',
        status: 'in_queue',
        isQuote: false,
        paymentId: 'payment-123',
        payment: {
          id: 'payment-123',
          status: 'pending',
          total: 5000,
          issuedDate: DateTime.now(),
          squareInvoiceId: 'inv-123',
        },
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
        netAmountDueMoney: { amount: BigInt(5000), currency: 'USD' },
      };

      const mockInvoice: Invoice = {
        id: 'inv-456',
        version: 1,
        createdAt: DateTime.now().toISO(),
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
      vi.mocked(mockPaymentRepo.savePayment).mockResolvedValue({
        id: 'payment-456',
        status: 'pending',
      });
      vi.mocked(mockRequestRepo.update).mockResolvedValue(mockRequest);

      // Act - should not throw
      await printPaymentService.upsertPayment(dto);

      // Assert - should proceed with canceling old invoice and creating new payment
      expect(mockSquareRepo.cancelInvoice).toHaveBeenCalledWith('inv-123');
      expect(mockSquareRepo.createOrder).toHaveBeenCalled();
      expect(mockPaymentRepo.savePayment).toHaveBeenCalled();
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

    it('should mark payment as paid when order total is zero', async () => {
      // Arrange
      const dto: CreatePaymentDto = {
        requestId: 'request-free',
        materialCost: 0,
        buildPlates: 1,
      };

      const mockRequest: PrintRequestDto = {
        id: 'request-free',
        customerName: 'Free User',
        email: 'free@example.com',
        status: 'in_queue',
        isQuote: false,
        paymentId: null,
      } as PrintRequestDto;

      const mockCustomer: Customer = {
        id: 'customer-free',
        emailAddress: 'free@example.com',
      };

      const mockOrder: Order = {
        id: 'order-free',
        locationId: 'loc-123',
        totalMoney: { amount: BigInt(0), currency: 'USD' },
        netAmountDueMoney: { amount: BigInt(0), currency: 'USD' },
      };

      const mockPayment = {
        id: 'payment-free',
        requestId: 'request-free',
        status: 'paid',
        total: 0,
        squareInvoiceId: null,
        squareOrderId: 'order-free',
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
      vi.mocked(mockPaymentRepo.savePayment).mockResolvedValue(mockPayment);
      vi.mocked(mockRequestRepo.update).mockResolvedValue(mockRequest);

      // Act
      const result = await printPaymentService.upsertPayment(dto);

      // Assert
      expect(mockSquareRepo.createOrder).toHaveBeenCalled();
      expect(mockPaymentRepo.createInvoice).not.toHaveBeenCalled();
      expect(mockSquareRepo.sendInvoice).not.toHaveBeenCalled();
      expect(mockPaymentRepo.savePayment).toHaveBeenCalledWith(
        'request-free',
        expect.objectContaining({
          status: 'paid',
          total: 0,
          squareInvoiceId: null,
          squareOrderId: 'order-free',
        }),
      );
      expect(result.status).toBe('paid');
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
    // Note: The following tests are skipped because respondToQuote has circular dependency
    // with printRequestService. In a real scenario, these would be integration tests.
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

    it('should throw error when calculate order fails for quote', async () => {
      // Arrange
      const dto: CreatePaymentDto = {
        requestId: 'request-quote-fail',
        materialCost: 8000,
        buildPlates: 2,
      };

      const mockRequest: PrintRequestDto = {
        id: 'request-quote-fail',
        customerName: 'Quote Fail Customer',
        email: 'quotefail@example.com',
        projectName: 'Quote Fail Project',
        status: 'in_queue',
        isQuote: true,
        paymentId: null,
        submissionDate: DateTime.now(),
      } as PrintRequestDto;

      const mockCustomer: Customer = {
        id: 'customer-quotefail',
        emailAddress: 'quotefail@example.com',
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
      vi.mocked(mockSquareRepo.calculateOrder).mockResolvedValue(null);

      // Act & Assert
      await expect(printPaymentService.upsertPayment(dto)).rejects.toThrow(
        'Failed to calculate order in Square',
      );
    });
  });

  describe('Group Billing', () => {
    describe('getPricingInfo with billing code', () => {
      it('should include billing code discount when valid billing code is provided', async () => {
        // Arrange
        const customerEmail = 'user@example.com';
        const billingCode = 'GROUP123';
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

        const mockBillingDiscount: CatalogObject = {
          type: 'DISCOUNT',
          id: 'billing-discount-456',
          discountData: {
            name: 'Group Discount',
            percentage: '20',
          },
        };

        const mockBillingCodeData = {
          billingCode: {
            id: 'billing-id-123',
            code: 'GROUP123',
            description: 'Group billing code',
            organizationId: 'org-123',
            discountId: 'billing-discount-456',
          },
          organization: {
            id: 'org-123',
            name: 'Test Organization',
            email: 'org@example.com',
            archived: false,
          },
        };

        vi.mocked(mockSettingsRepo.getSetting).mockResolvedValue(mockSquareSettings);
        vi.mocked(squareServiceMock.checkActiveMember).mockResolvedValue(false);
        vi.mocked(mockBillingCodeRepo.getByCode).mockResolvedValue(mockBillingCodeData);
        vi.mocked(mockSquareRepo.getCatalogByIds).mockResolvedValue({
          objects: [mockBuildPlateItem, mockBillingDiscount],
        });

        // Act
        const result = await printPaymentService.getPricingInfo(customerEmail, billingCode);

        // Assert
        expect(mockBillingCodeRepo.getByCode).toHaveBeenCalledWith('GROUP123');
        expect(mockSquareRepo.getCatalogByIds).toHaveBeenCalledWith([
          'plate-456',
          'billing-discount-456',
        ]);
        expect(result).toEqual({
          additionalBuildPlateModifier: 1000,
          discounts: [
            {
              id: 'billing-discount-456',
              name: 'Group Discount',
              percentage: 20,
            },
          ],
        });
      });

      it('should include both member and billing code discounts when user is active member with billing code', async () => {
        // Arrange
        const customerEmail = 'member@example.com';
        const billingCode = 'GROUP456';
        const mockSquareSettings = {
          locationId: 'loc-123',
          printRequestItemId: 'item-123',
          additionalBuildPlateItemId: 'plate-456',
          memberPrintDiscountId: 'member-discount-789',
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
          id: 'member-discount-789',
          discountData: {
            name: 'Member Discount',
            percentage: '15',
          },
        };

        const mockBillingDiscount: CatalogObject = {
          type: 'DISCOUNT',
          id: 'billing-discount-999',
          discountData: {
            name: 'Organization Discount',
            percentage: '25',
          },
        };

        const mockBillingCodeData = {
          billingCode: {
            id: 'billing-id-456',
            code: 'GROUP456',
            description: 'Organization billing code',
            organizationId: 'org-456',
            discountId: 'billing-discount-999',
          },
          organization: null,
        };

        vi.mocked(mockSettingsRepo.getSetting).mockResolvedValue(mockSquareSettings);
        vi.mocked(squareServiceMock.checkActiveMember).mockResolvedValue(true);
        vi.mocked(mockBillingCodeRepo.getByCode).mockResolvedValue(mockBillingCodeData);
        vi.mocked(mockSquareRepo.getCatalogByIds).mockResolvedValue({
          objects: [mockBuildPlateItem, mockMemberDiscount, mockBillingDiscount],
        });

        // Act
        const result = await printPaymentService.getPricingInfo(customerEmail, billingCode);

        // Assert
        expect(mockBillingCodeRepo.getByCode).toHaveBeenCalledWith('GROUP456');
        expect(mockSquareRepo.getCatalogByIds).toHaveBeenCalledWith([
          'plate-456',
          'member-discount-789',
          'billing-discount-999',
        ]);
        expect(result.discounts).toHaveLength(2);
        expect(result.discounts).toEqual(
          expect.arrayContaining([
            {
              id: 'member-discount-789',
              name: 'Member Discount',
              percentage: 15,
            },
            {
              id: 'billing-discount-999',
              name: 'Organization Discount',
              percentage: 25,
            },
          ]),
        );
      });

      it('should not include billing code discount when billing code has no discount', async () => {
        // Arrange
        const customerEmail = 'user@example.com';
        const billingCode = 'NODISCOUNT';
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

        const mockBillingCodeData = {
          billingCode: {
            id: 'billing-id-789',
            code: 'NODISCOUNT',
            description: 'Billing code without discount',
            organizationId: 'org-789',
            discountId: null,
          },
          organization: null,
        };

        vi.mocked(mockSettingsRepo.getSetting).mockResolvedValue(mockSquareSettings);
        vi.mocked(squareServiceMock.checkActiveMember).mockResolvedValue(false);
        vi.mocked(mockBillingCodeRepo.getByCode).mockResolvedValue(mockBillingCodeData);
        vi.mocked(mockSquareRepo.getCatalogByIds).mockResolvedValue({
          objects: [mockBuildPlateItem],
        });

        // Act
        const result = await printPaymentService.getPricingInfo(customerEmail, billingCode);

        // Assert
        expect(mockBillingCodeRepo.getByCode).toHaveBeenCalledWith('NODISCOUNT');
        expect(mockSquareRepo.getCatalogByIds).toHaveBeenCalledWith(['plate-456']);
        expect(result.discounts).toHaveLength(0);
      });

      it('should not include billing code discount when billing code is not found', async () => {
        // Arrange
        const customerEmail = 'user@example.com';
        const billingCode = 'INVALID';
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

        vi.mocked(mockSettingsRepo.getSetting).mockResolvedValue(mockSquareSettings);
        vi.mocked(squareServiceMock.checkActiveMember).mockResolvedValue(false);
        vi.mocked(mockBillingCodeRepo.getByCode).mockResolvedValue(null);
        vi.mocked(mockSquareRepo.getCatalogByIds).mockResolvedValue({
          objects: [mockBuildPlateItem],
        });

        // Act
        const result = await printPaymentService.getPricingInfo(customerEmail, billingCode);

        // Assert
        expect(mockBillingCodeRepo.getByCode).toHaveBeenCalledWith('INVALID');
        expect(mockSquareRepo.getCatalogByIds).toHaveBeenCalledWith(['plate-456']);
        expect(result.discounts).toHaveLength(0);
      });
    });

    describe('upsertPayment with organization billing', () => {
      it('should handle organization billing when billing code has organization', async () => {
        // Arrange
        const dto: CreatePaymentDto = {
          requestId: 'request-org',
          materialCost: 10000,
          buildPlates: 3,
        };

        const mockRequest: PrintRequestDto = {
          id: 'request-org',
          customerName: 'Org User',
          email: 'orguser@example.com',
          projectName: 'Org Project',
          status: 'in_queue',
          isQuote: false,
          paymentId: null,
          billingCode: 'ORG123',
          submissionDate: DateTime.now(),
        } as PrintRequestDto;

        const mockBillingCodeData = {
          billingCode: {
            id: 'billing-code-123',
            code: 'ORG123',
            description: 'Organization code',
            organizationId: 'org-123',
            discountId: 'org-discount-456',
          },
          organization: {
            id: 'org-123',
            name: 'Test Organization',
            email: 'billing@org.com',
            archived: false,
          },
        };

        const mockCustomer: Customer = {
          id: 'customer-org',
          emailAddress: 'orguser@example.com',
        };

        const mockCalculatedOrder: Order = {
          id: 'order-org',
          locationId: 'loc-123',
          netAmountDueMoney: { amount: BigInt(12000), currency: 'USD' },
        };

        const mockPayment = {
          id: 'payment-org',
          requestId: 'request-org',
          status: 'pending',
          total: 12000,
          organizationId: 'org-123',
          type: 'print_request',
        };

        const mockSquareSettings = {
          locationId: 'loc-123',
          printRequestItemId: 'item-123',
          additionalBuildPlateItemId: 'plate-456',
          memberPrintDiscountId: 'member-discount-789',
        };

        vi.mocked(mockRequestRepo.getById).mockResolvedValue(mockRequest);
        vi.mocked(mockBillingCodeRepo.getByCode).mockResolvedValue(mockBillingCodeData);
        vi.mocked(mockBillingCodeRepo.getById).mockResolvedValue(mockBillingCodeData);
        vi.mocked(mockSettingsRepo.getSetting).mockResolvedValue(mockSquareSettings);
        vi.mocked(mockSquareRepo.upsertCustomer).mockResolvedValue(mockCustomer);
        vi.mocked(mockSquareRepo.calculateOrder).mockResolvedValue(mockCalculatedOrder);
        vi.mocked(mockPaymentRepo.savePayment).mockResolvedValue(mockPayment);
        vi.mocked(mockRequestRepo.update).mockResolvedValue(mockRequest);

        // Act
        const result = await printPaymentService.upsertPayment(dto);

        // Assert
        expect(mockBillingCodeRepo.getByCode).toHaveBeenCalledWith('ORG123');
        expect(mockBillingCodeRepo.getById).toHaveBeenCalledWith('billing-code-123');
        expect(mockSquareRepo.upsertCustomer).toHaveBeenCalledWith(
          'Org User',
          'orguser@example.com',
        );
        expect(mockSquareRepo.calculateOrder).toHaveBeenCalled();
        expect(mockSquareRepo.createOrder).not.toHaveBeenCalled();
        expect(mockSquareRepo.sendInvoice).not.toHaveBeenCalled();
        expect(mockPaymentRepo.savePayment).toHaveBeenCalledWith(
          'request-org',
          expect.objectContaining({
            status: 'pending',
            total: 12000,
            organizationId: 'org-123',
            type: 'print_request',
            squareInvoiceId: null,
            squareOrderId: null,
          }),
        );
        expect(mockRequestRepo.update).toHaveBeenCalledWith('request-org', {
          materialCost: 10000,
          buildplateCount: 3,
        });
        expect(result).toEqual(mockPayment);
      });

      it('should use billing code discount (not member discount) for organization billing', async () => {
        // Arrange
        const dto: CreatePaymentDto = {
          requestId: 'request-org-member',
          materialCost: 5000,
          buildPlates: 1,
        };

        const mockRequest: PrintRequestDto = {
          id: 'request-org-member',
          customerName: 'Org Member',
          email: 'orgmember@example.com',
          projectName: 'Org Member Project',
          status: 'in_queue',
          isQuote: false,
          paymentId: null,
          billingCode: 'ORGMEMBER',
          submissionDate: DateTime.now(),
        } as PrintRequestDto;

        const mockBillingCodeData = {
          billingCode: {
            id: 'billing-code-456',
            code: 'ORGMEMBER',
            description: 'Org member code',
            organizationId: 'org-456',
            discountId: 'org-discount-789',
          },
          organization: {
            id: 'org-456',
            name: 'Member Organization',
            email: 'billing@memberorg.com',
            archived: false,
          },
        };

        const mockCustomer: Customer = {
          id: 'customer-org-member',
          emailAddress: 'orgmember@example.com',
        };

        const mockCalculatedOrder: Order = {
          id: 'order-org-member',
          locationId: 'loc-123',
          netAmountDueMoney: { amount: BigInt(4500), currency: 'USD' },
        };

        const mockPayment = {
          id: 'payment-org-member',
          requestId: 'request-org-member',
          status: 'pending',
          organizationId: 'org-456',
        };

        const mockSquareSettings = {
          locationId: 'loc-123',
          printRequestItemId: 'item-123',
          additionalBuildPlateItemId: 'plate-456',
          memberPrintDiscountId: 'member-discount-999',
        };

        vi.mocked(mockRequestRepo.getById).mockResolvedValue(mockRequest);
        vi.mocked(mockBillingCodeRepo.getByCode).mockResolvedValue(mockBillingCodeData);
        vi.mocked(mockBillingCodeRepo.getById).mockResolvedValue(mockBillingCodeData);
        vi.mocked(mockSettingsRepo.getSetting).mockResolvedValue(mockSquareSettings);
        vi.mocked(mockSquareRepo.upsertCustomer).mockResolvedValue(mockCustomer);
        vi.mocked(mockSquareRepo.calculateOrder).mockResolvedValue(mockCalculatedOrder);
        vi.mocked(mockPaymentRepo.savePayment).mockResolvedValue(mockPayment);
        vi.mocked(mockRequestRepo.update).mockResolvedValue(mockRequest);
        // Member check should not be called for organization billing
        vi.mocked(squareServiceMock.checkActiveMember).mockResolvedValue(true);

        // Act
        await printPaymentService.upsertPayment(dto);

        // Assert
        const orderCall = vi.mocked(mockSquareRepo.calculateOrder).mock.calls[0][0];
        // Verify discount is from billing code, not member discount
        expect(orderCall.order.discounts).toHaveLength(1);
        expect(orderCall.order.discounts[0].catalogObjectId).toBe('org-discount-789');
        // Member discount should NOT be in the order
        expect(orderCall.order.discounts[0].catalogObjectId).not.toBe('member-discount-999');
        // Member check should not be called in organization billing flow
        expect(squareServiceMock.checkActiveMember).not.toHaveBeenCalled();
      });

      it('should handle organization billing without discount when billing code has no discount', async () => {
        // Arrange
        const dto: CreatePaymentDto = {
          requestId: 'request-org-nodiscount',
          materialCost: 7000,
          buildPlates: 2,
        };

        const mockRequest: PrintRequestDto = {
          id: 'request-org-nodiscount',
          customerName: 'Org No Discount',
          email: 'nodiscount@example.com',
          projectName: 'No Discount Project',
          status: 'in_queue',
          isQuote: false,
          paymentId: null,
          billingCode: 'ORGNODISCOUNT',
          submissionDate: DateTime.now(),
        } as PrintRequestDto;

        const mockBillingCodeData = {
          billingCode: {
            id: 'billing-code-789',
            code: 'ORGNODISCOUNT',
            description: 'Org code without discount',
            organizationId: 'org-789',
            discountId: null,
          },
          organization: {
            id: 'org-789',
            name: 'No Discount Org',
            email: 'billing@nodiscount.com',
            archived: false,
          },
        };

        const mockCustomer: Customer = {
          id: 'customer-org-nodiscount',
          emailAddress: 'nodiscount@example.com',
        };

        const mockCalculatedOrder: Order = {
          id: 'order-org-nodiscount',
          locationId: 'loc-123',
          netAmountDueMoney: { amount: BigInt(7000), currency: 'USD' },
        };

        const mockPayment = {
          id: 'payment-org-nodiscount',
          requestId: 'request-org-nodiscount',
          status: 'pending',
          organizationId: 'org-789',
        };

        const mockSquareSettings = {
          locationId: 'loc-123',
          printRequestItemId: 'item-123',
          additionalBuildPlateItemId: 'plate-456',
          memberPrintDiscountId: 'member-discount-999',
        };

        vi.mocked(mockRequestRepo.getById).mockResolvedValue(mockRequest);
        vi.mocked(mockBillingCodeRepo.getByCode).mockResolvedValue(mockBillingCodeData);
        vi.mocked(mockBillingCodeRepo.getById).mockResolvedValue(mockBillingCodeData);
        vi.mocked(mockSettingsRepo.getSetting).mockResolvedValue(mockSquareSettings);
        vi.mocked(mockSquareRepo.upsertCustomer).mockResolvedValue(mockCustomer);
        vi.mocked(mockSquareRepo.calculateOrder).mockResolvedValue(mockCalculatedOrder);
        vi.mocked(mockPaymentRepo.savePayment).mockResolvedValue(mockPayment);
        vi.mocked(mockRequestRepo.update).mockResolvedValue(mockRequest);

        // Act
        await printPaymentService.upsertPayment(dto);

        // Assert
        const orderCall = vi.mocked(mockSquareRepo.calculateOrder).mock.calls[0][0];
        // When there's no discount, discounts array should be empty or have length 0
        expect(orderCall.order.discounts ?? []).toHaveLength(0);
        expect(mockPaymentRepo.savePayment).toHaveBeenCalledWith(
          'request-org-nodiscount',
          expect.objectContaining({
            organizationId: 'org-789',
          }),
        );
      });

      it('should throw error when organization billing calculateOrder fails', async () => {
        // Arrange
        const dto: CreatePaymentDto = {
          requestId: 'request-org-fail',
          materialCost: 5000,
          buildPlates: 1,
        };

        const mockRequest: PrintRequestDto = {
          id: 'request-org-fail',
          customerName: 'Org Fail User',
          email: 'orgfail@example.com',
          projectName: 'Org Fail Project',
          status: 'in_queue',
          isQuote: false,
          paymentId: null,
          billingCode: 'ORGFAIL',
          submissionDate: DateTime.now(),
        } as PrintRequestDto;

        const mockBillingCodeData = {
          billingCode: {
            id: 'billing-code-fail',
            code: 'ORGFAIL',
            description: 'Org fail code',
            organizationId: 'org-fail',
            discountId: 'discount-fail',
          },
          organization: {
            id: 'org-fail',
            name: 'Fail Organization',
            email: 'billing@fail.com',
            archived: false,
          },
        };

        const mockCustomer: Customer = {
          id: 'customer-org-fail',
          emailAddress: 'orgfail@example.com',
        };

        const mockSquareSettings = {
          locationId: 'loc-123',
          printRequestItemId: 'item-123',
          additionalBuildPlateItemId: 'plate-456',
          memberPrintDiscountId: 'member-discount-999',
        };

        vi.mocked(mockRequestRepo.getById).mockResolvedValue(mockRequest);
        vi.mocked(mockBillingCodeRepo.getByCode).mockResolvedValue(mockBillingCodeData);
        vi.mocked(mockBillingCodeRepo.getById).mockResolvedValue(mockBillingCodeData);
        vi.mocked(mockSettingsRepo.getSetting).mockResolvedValue(mockSquareSettings);
        vi.mocked(mockSquareRepo.upsertCustomer).mockResolvedValue(mockCustomer);
        vi.mocked(mockSquareRepo.calculateOrder).mockResolvedValue(null);

        // Act & Assert
        await expect(printPaymentService.upsertPayment(dto)).rejects.toThrow(
          'Failed to calculate order in Square',
        );
      });

      it('should use regular invoice flow when billing code exists but has no organization', async () => {
        // Arrange
        const dto: CreatePaymentDto = {
          requestId: 'request-billing-no-org',
          materialCost: 6000,
          buildPlates: 1,
        };

        const mockRequest: PrintRequestDto = {
          id: 'request-billing-no-org',
          customerName: 'No Org User',
          email: 'noorg@example.com',
          projectName: 'No Org Project',
          status: 'in_queue',
          isQuote: false,
          paymentId: null,
          billingCode: 'NOORG',
          submissionDate: DateTime.now(),
        } as PrintRequestDto;

        const mockBillingCodeData = {
          billingCode: {
            id: 'billing-code-noorg',
            code: 'NOORG',
            description: 'Code without organization',
            organizationId: null,
            discountId: 'discount-noorg',
          },
          organization: null,
        };

        const mockCustomer: Customer = {
          id: 'customer-noorg',
          emailAddress: 'noorg@example.com',
        };

        const mockOrder: Order = {
          id: 'order-noorg',
          locationId: 'loc-123',
          netAmountDueMoney: { amount: BigInt(5400), currency: 'USD' },
        };

        const mockInvoice: Invoice = {
          id: 'inv-noorg',
          version: 1,
          createdAt: DateTime.now().toISO(),
        };

        const mockPayment = {
          id: 'payment-noorg',
          requestId: 'request-billing-no-org',
          status: 'pending',
          squareInvoiceId: 'inv-noorg',
          squareOrderId: 'order-noorg',
        };

        const mockSquareSettings = {
          locationId: 'loc-123',
          printRequestItemId: 'item-123',
          additionalBuildPlateItemId: 'plate-456',
          memberPrintDiscountId: 'member-discount-999',
        };

        vi.mocked(mockRequestRepo.getById).mockResolvedValue(mockRequest);
        vi.mocked(mockBillingCodeRepo.getByCode).mockResolvedValue(mockBillingCodeData);
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
        expect(mockSquareRepo.createOrder).toHaveBeenCalled();
        expect(mockPaymentRepo.createInvoice).toHaveBeenCalledWith(mockOrder);
        expect(mockSquareRepo.sendInvoice).toHaveBeenCalledWith('inv-noorg', 1);
        expect(mockSquareRepo.calculateOrder).not.toHaveBeenCalled();
        expect(mockPaymentRepo.savePayment).toHaveBeenCalledWith(
          'request-billing-no-org',
          expect.objectContaining({
            status: 'pending',
            squareInvoiceId: 'inv-noorg',
            squareOrderId: 'order-noorg',
          }),
        );
      });
    });

    describe('Archived billing codes in payment processing', () => {
      it('should allow processing payment with archived billing code that has discount', async () => {
        // Arrange - archived billing codes should still be retrievable and usable in payment processing
        const dto: CreatePaymentDto = {
          requestId: 'request-archived',
          materialCost: 5000,
          buildPlates: 1,
        };

        const mockRequest: PrintRequestDto = {
          id: 'request-archived',
          customerName: 'Test User',
          email: 'user@example.com',
          projectName: 'Test Project',
          status: 'in_queue',
          isQuote: false,
          paymentId: null,
          billingCode: 'ARCHIVED123',
          submissionDate: DateTime.now(),
        } as PrintRequestDto;

        // The billing code is archived, but should still be retrievable
        const mockBillingCodeData = {
          billingCode: {
            id: 'billing-archived',
            code: 'ARCHIVED123',
            description: 'Archived billing code',
            organizationId: null,
            discountId: 'archived-discount-123',
            archived: true, // ARCHIVED
          },
          organization: null,
        };

        const mockCustomer: Customer = {
          id: 'customer-123',
          emailAddress: 'user@example.com',
        };

        const mockOrder: Order = {
          id: 'order-archived',
          locationId: 'loc-123',
          netAmountDueMoney: { amount: BigInt(4000), currency: 'USD' },
          version: 1,
        };

        const mockInvoice: Invoice = {
          id: 'inv-archived',
          version: 1,
          createdAt: DateTime.now().toISO(),
        };

        const mockPayment = {
          id: 'payment-archived',
          requestId: 'request-archived',
          status: 'pending',
          total: 4000,
        };

        const mockSquareSettings = {
          locationId: 'loc-123',
          printRequestItemId: 'item-123',
          additionalBuildPlateItemId: 'plate-456',
          memberPrintDiscountId: 'member-discount-789',
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

        const mockArchivedDiscount: CatalogObject = {
          type: 'DISCOUNT',
          id: 'archived-discount-123',
          discountData: {
            name: 'Archived Discount',
            percentage: '20',
          },
        };

        vi.mocked(mockRequestRepo.getById).mockResolvedValue(mockRequest);
        vi.mocked(mockBillingCodeRepo.getByCode).mockResolvedValue(mockBillingCodeData);
        vi.mocked(mockSettingsRepo.getSetting).mockResolvedValue(mockSquareSettings);
        vi.mocked(squareServiceMock.checkActiveMember).mockResolvedValue(false);
        vi.mocked(mockSquareRepo.getCatalogByIds).mockResolvedValue({
          objects: [mockBuildPlateItem, mockArchivedDiscount],
        });
        vi.mocked(mockSquareRepo.upsertCustomer).mockResolvedValue(mockCustomer);
        vi.mocked(mockSquareRepo.createOrder).mockResolvedValue(mockOrder);
        vi.mocked(mockPaymentRepo.createInvoice).mockResolvedValue(mockInvoice);
        vi.mocked(mockSquareRepo.sendInvoice).mockResolvedValue(undefined);
        vi.mocked(mockPaymentRepo.savePayment).mockResolvedValue(mockPayment);
        vi.mocked(mockRequestRepo.update).mockResolvedValue(mockRequest);

        // Act
        const result = await printPaymentService.upsertPayment(dto);

        // Assert
        // Verify that the billing code was retrieved even though it's archived
        expect(mockBillingCodeRepo.getByCode).toHaveBeenCalledWith('ARCHIVED123');

        // Verify that the discount from the archived billing code was still applied
        expect(mockSquareRepo.createOrder).toHaveBeenCalledWith(
          expect.objectContaining({
            order: expect.objectContaining({
              discounts: expect.arrayContaining([
                expect.objectContaining({
                  catalogObjectId: 'archived-discount-123',
                }),
              ]),
            }),
          }),
        );

        expect(result).toBeDefined();
        expect(result.status).toBe('pending');
      });

      it('should allow organization billing with archived billing code', async () => {
        // Arrange - archived billing codes with organizations should still work
        const dto: CreatePaymentDto = {
          requestId: 'request-org-archived',
          materialCost: 8000,
          buildPlates: 2,
        };

        const mockRequest: PrintRequestDto = {
          id: 'request-org-archived',
          customerName: 'Org User',
          email: 'user@org.com',
          projectName: 'Org Project',
          status: 'in_queue',
          isQuote: false,
          paymentId: null,
          billingCode: 'OLDORG123',
          submissionDate: DateTime.now(),
        } as PrintRequestDto;

        // Archived billing code with organization
        const mockBillingCodeData = {
          billingCode: {
            id: 'billing-old-org',
            code: 'OLDORG123',
            description: 'Old organization code',
            organizationId: 'org-archived',
            discountId: 'org-discount-old',
            archived: true, // ARCHIVED
          },
          organization: {
            id: 'org-archived',
            name: 'Old Organization',
            email: 'billing@oldorg.com',
            archived: false, // Organization is not archived
          },
        };

        const mockCustomer: Customer = {
          id: 'customer-org',
          emailAddress: 'billing@oldorg.com',
        };

        const mockCalculatedOrder: Order = {
          id: 'order-org-archived',
          locationId: 'loc-123',
          netAmountDueMoney: { amount: BigInt(7000), currency: 'USD' },
        };

        const mockPayment = {
          id: 'payment-org-archived',
          requestId: 'request-org-archived',
          status: 'pending',
          total: 7000,
          organizationId: 'org-archived',
          type: 'print_request',
        };

        const mockSquareSettings = {
          locationId: 'loc-123',
          printRequestItemId: 'item-123',
          additionalBuildPlateItemId: 'plate-456',
          memberPrintDiscountId: 'member-discount-789',
        };

        vi.mocked(mockRequestRepo.getById).mockResolvedValue(mockRequest);
        vi.mocked(mockBillingCodeRepo.getByCode).mockResolvedValue(mockBillingCodeData);
        vi.mocked(mockSettingsRepo.getSetting).mockResolvedValue(mockSquareSettings);
        vi.mocked(squareServiceMock.checkActiveMember).mockResolvedValue(false);
        vi.mocked(mockSquareRepo.upsertCustomer).mockResolvedValue(mockCustomer);
        vi.mocked(mockSquareRepo.calculateOrder).mockResolvedValue(mockCalculatedOrder);
        vi.mocked(mockPaymentRepo.savePayment).mockResolvedValue(mockPayment);
        vi.mocked(mockRequestRepo.update).mockResolvedValue(mockRequest);

        // Act
        const result = await printPaymentService.upsertPayment(dto);

        // Assert
        // Verify that the archived billing code was still used for organization billing
        expect(mockBillingCodeRepo.getByCode).toHaveBeenCalledWith('OLDORG123');
        // Organization billing uses the request's customer info, not the organization's
        expect(mockSquareRepo.upsertCustomer).toHaveBeenCalledWith('Org User', 'user@org.com');
        expect(mockPaymentRepo.savePayment).toHaveBeenCalledWith(
          'request-org-archived',
          expect.objectContaining({
            organizationId: 'org-archived',
            type: 'print_request',
          }),
        );
        expect(result.organizationId).toBe('org-archived');
      });

      it('should handle getPricingInfo with archived billing code', async () => {
        // Arrange
        const customerEmail = 'user@example.com';
        const billingCode = 'ARCHIVED456';

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

        const mockArchivedDiscount: CatalogObject = {
          type: 'DISCOUNT',
          id: 'archived-discount-456',
          discountData: {
            name: 'Archived Code Discount',
            percentage: '15',
          },
        };

        const mockBillingCodeData = {
          billingCode: {
            id: 'billing-archived-456',
            code: 'ARCHIVED456',
            description: 'Another archived code',
            organizationId: null,
            discountId: 'archived-discount-456',
            archived: true, // ARCHIVED
          },
          organization: null,
        };

        vi.mocked(mockSettingsRepo.getSetting).mockResolvedValue(mockSquareSettings);
        vi.mocked(squareServiceMock.checkActiveMember).mockResolvedValue(false);
        vi.mocked(mockBillingCodeRepo.getByCode).mockResolvedValue(mockBillingCodeData);
        vi.mocked(mockSquareRepo.getCatalogByIds).mockResolvedValue({
          objects: [mockBuildPlateItem, mockArchivedDiscount],
        });

        // Act
        const result = await printPaymentService.getPricingInfo(customerEmail, billingCode);

        // Assert
        expect(mockBillingCodeRepo.getByCode).toHaveBeenCalledWith('ARCHIVED456');
        expect(result.discounts).toHaveLength(1);
        expect(result.discounts[0]).toEqual({
          id: 'archived-discount-456',
          name: 'Archived Code Discount',
          percentage: 15,
        });
      });
    });
  });

  describe('updatePrintRequestDiscount', () => {
    // Shared helpers
    const mockSquareSettings = {
      locationId: 'loc-123',
      printRequestItemId: 'item-123',
      additionalBuildPlateItemId: 'plate-456',
      memberPrintDiscountId: 'discount-member',
    };

    const mockCustomer: Customer = {
      id: 'customer-123',
      emailAddress: 'john@example.com',
      givenName: 'John',
      familyName: 'Doe',
    };

    const mockOrder: Order = {
      id: 'order-new',
      locationId: 'loc-123',
      netAmountDueMoney: { amount: BigInt(5000), currency: 'USD' },
      totalMoney: { amount: BigInt(5000), currency: 'USD' },
    };

    const mockInvoice: Invoice = {
      id: 'inv-new',
      version: 1,
      createdAt: DateTime.now().toISO(),
    };

    const mockCalculatedOrder: Order = {
      id: 'calc-order',
      locationId: 'loc-123',
      netAmountDueMoney: { amount: BigInt(4000), currency: 'USD' },
    };

    function setupUpsertOrderMocks() {
      vi.mocked(mockSettingsRepo.getSetting).mockResolvedValue(mockSquareSettings);
      vi.mocked(squareServiceMock.checkActiveMember).mockResolvedValue(false);
      vi.mocked(mockSquareRepo.upsertCustomer).mockResolvedValue(mockCustomer);
      vi.mocked(mockSquareRepo.createOrder).mockResolvedValue(mockOrder);
      vi.mocked(mockPaymentRepo.createInvoice).mockResolvedValue(mockInvoice);
      vi.mocked(mockSquareRepo.sendInvoice).mockResolvedValue(undefined);
      vi.mocked(mockPaymentRepo.savePayment).mockResolvedValue({ id: 'payment-new', status: 'pending' });
      vi.mocked(mockSquareRepo.calculateOrder).mockResolvedValue(mockCalculatedOrder);
    }

    // === Validation tests ===

    it('should throw error when print request not found', async () => {
      vi.mocked(mockRequestRepo.getById).mockResolvedValue(null);

      await expect(
        printPaymentService.updatePrintRequestDiscount('nonexistent', { billingCode: 'CODE' }),
      ).rejects.toThrow('Print request not found');
    });

    it('should throw error when billing code not found', async () => {
      const mockRequest = {
        id: 'req-1',
        billingCode: null,
        payment: null,
        materialCost: 5000,
        buildplateCount: 1,
      } as unknown as PrintRequestDto;

      vi.mocked(mockRequestRepo.getById).mockResolvedValue(mockRequest);
      vi.mocked(mockBillingCodeRepo.getByCode).mockResolvedValue(null);

      await expect(
        printPaymentService.updatePrintRequestDiscount('req-1', { billingCode: 'INVALID' }),
      ).rejects.toThrow('Billing code not found');
    });

    // === No existing payment tests ===

    it('no payment: should only update billing code field (no payment reprocessing)', async () => {
      const mockRequest = {
        id: 'req-1',
        customerName: 'John Doe',
        email: 'john@example.com',
        billingCode: null,
        payment: null,
        materialCost: 5000,
        buildplateCount: 1,
      } as unknown as PrintRequestDto;

      const discountCode = {
        billingCode: { id: 'bc-1', code: 'SAVE10', discountId: 'disc-1', organizationId: null },
        organization: null,
      };

      vi.mocked(mockRequestRepo.getById).mockResolvedValue(mockRequest);
      vi.mocked(mockBillingCodeRepo.getByCode).mockResolvedValue(discountCode);
      vi.mocked(mockRequestRepo.update).mockResolvedValue([]);

      await printPaymentService.updatePrintRequestDiscount('req-1', { billingCode: 'SAVE10' });

      expect(mockRequestRepo.update).toHaveBeenCalledWith('req-1', { billingCode: 'SAVE10' });
      expect(mockSquareRepo.cancelInvoice).not.toHaveBeenCalled();
      expect(mockSquareRepo.createOrder).not.toHaveBeenCalled();
      expect(mockPaymentRepo.savePayment).not.toHaveBeenCalled();
    });

    // === Already finalized payment tests ===

    it('paid payment: should only update billing code (no reprocessing)', async () => {
      const mockRequest = {
        id: 'req-1',
        customerName: 'John Doe',
        email: 'john@example.com',
        billingCode: null,
        payment: { id: 'pay-1', status: 'paid', squareInvoiceId: 'inv-1' },
        materialCost: 5000,
        buildplateCount: 1,
      } as unknown as PrintRequestDto;

      const orgCode = {
        billingCode: { id: 'bc-org', code: 'ORGCODE', discountId: null, organizationId: 'org-1' },
        organization: { id: 'org-1', name: 'Test Org' },
      };

      vi.mocked(mockRequestRepo.getById).mockResolvedValue(mockRequest);
      vi.mocked(mockBillingCodeRepo.getByCode).mockResolvedValue(orgCode);
      vi.mocked(mockRequestRepo.update).mockResolvedValue([]);

      await printPaymentService.updatePrintRequestDiscount('req-1', { billingCode: 'ORGCODE' });

      expect(mockRequestRepo.update).toHaveBeenCalledWith('req-1', { billingCode: 'ORGCODE' });
      expect(mockSquareRepo.cancelInvoice).not.toHaveBeenCalled();
      expect(mockSquareRepo.createOrder).not.toHaveBeenCalled();
    });

    it('canceled payment: should only update billing code (no reprocessing)', async () => {
      const mockRequest = {
        id: 'req-1',
        customerName: 'John Doe',
        email: 'john@example.com',
        billingCode: 'OLD',
        payment: { id: 'pay-1', status: 'canceled', squareInvoiceId: 'inv-1' },
        materialCost: 5000,
        buildplateCount: 1,
      } as unknown as PrintRequestDto;

      vi.mocked(mockRequestRepo.getById).mockResolvedValue(mockRequest);
      vi.mocked(mockBillingCodeRepo.getByCode).mockResolvedValue(null);
      vi.mocked(mockRequestRepo.update).mockResolvedValue([]);

      await printPaymentService.updatePrintRequestDiscount('req-1', { billingCode: '' });

      expect(mockRequestRepo.update).toHaveBeenCalledWith('req-1', { billingCode: null });
      expect(mockSquareRepo.cancelInvoice).not.toHaveBeenCalled();
      expect(mockSquareRepo.createOrder).not.toHaveBeenCalled();
    });

    // === Clearing discount code tests ===

    it('clear code: should clear billing code and re-create Square invoice when pending invoice exists', async () => {
      const mockRequest = {
        id: 'req-1',
        customerName: 'John Doe',
        email: 'john@example.com',
        billingCode: 'ORGCODE',
        payment: { id: 'pay-1', status: 'pending', squareInvoiceId: 'inv-old' },
        materialCost: 5000,
        buildplateCount: 1,
        isQuote: false,
      } as unknown as PrintRequestDto;

      const updatedRequest = { ...mockRequest, billingCode: null };

      vi.mocked(mockRequestRepo.getById)
        .mockResolvedValueOnce(mockRequest)       // initial fetch
        .mockResolvedValueOnce(updatedRequest)     // fetch after update for upsertOrder
        .mockResolvedValueOnce(updatedRequest);    // final fetch for return

      vi.mocked(mockRequestRepo.update).mockResolvedValue([]);
      vi.mocked(mockSquareRepo.cancelInvoice).mockResolvedValue(undefined);
      setupUpsertOrderMocks();

      await printPaymentService.updatePrintRequestDiscount('req-1', { billingCode: '' });

      expect(mockRequestRepo.update).toHaveBeenCalledWith('req-1', { billingCode: null });
      expect(mockSquareRepo.cancelInvoice).toHaveBeenCalledWith('inv-old');
      expect(mockSquareRepo.createOrder).toHaveBeenCalled();
      expect(mockPaymentRepo.savePayment).toHaveBeenCalled();
    });

    it('clear code: should clear billing code and re-create Square invoice when org payment (no invoice) exists', async () => {
      const mockRequest = {
        id: 'req-1',
        customerName: 'John Doe',
        email: 'john@example.com',
        billingCode: 'ORGCODE',
        payment: { id: 'pay-1', status: 'pending', squareInvoiceId: null, organizationId: 'org-1' },
        materialCost: 5000,
        buildplateCount: 1,
        isQuote: false,
      } as unknown as PrintRequestDto;

      const updatedRequest = { ...mockRequest, billingCode: null };

      vi.mocked(mockRequestRepo.getById)
        .mockResolvedValueOnce(mockRequest)
        .mockResolvedValueOnce(updatedRequest)
        .mockResolvedValueOnce(updatedRequest);

      vi.mocked(mockRequestRepo.update).mockResolvedValue([]);
      setupUpsertOrderMocks();

      await printPaymentService.updatePrintRequestDiscount('req-1', { billingCode: '' });

      expect(mockSquareRepo.cancelInvoice).not.toHaveBeenCalled(); // no squareInvoiceId
      expect(mockSquareRepo.createOrder).toHaveBeenCalled(); // new invoice created
      expect(mockPaymentRepo.savePayment).toHaveBeenCalled();
    });

    // === No code -> Org billing code ===

    it('none -> org code: should cancel Square invoice and create org billing payment', async () => {
      const mockRequest = {
        id: 'req-1',
        customerName: 'John Doe',
        email: 'john@example.com',
        billingCode: null,
        payment: { id: 'pay-1', status: 'pending', squareInvoiceId: 'inv-old' },
        materialCost: 5000,
        buildplateCount: 1,
        isQuote: false,
      } as unknown as PrintRequestDto;

      const orgCode = {
        billingCode: { id: 'bc-org', code: 'ORGCODE', discountId: null, organizationId: 'org-1' },
        organization: { id: 'org-1', name: 'Test Org' },
      };

      const updatedRequest = { ...mockRequest, billingCode: 'ORGCODE' };

      vi.mocked(mockRequestRepo.getById)
        .mockResolvedValueOnce(mockRequest)
        .mockResolvedValueOnce(updatedRequest)
        .mockResolvedValueOnce(updatedRequest);

      vi.mocked(mockBillingCodeRepo.getByCode).mockResolvedValue(orgCode);
      vi.mocked(mockBillingCodeRepo.getById).mockResolvedValue(orgCode);
      vi.mocked(mockRequestRepo.update).mockResolvedValue([]);
      vi.mocked(mockSquareRepo.cancelInvoice).mockResolvedValue(undefined);
      setupUpsertOrderMocks();

      await printPaymentService.updatePrintRequestDiscount('req-1', { billingCode: 'ORGCODE' });

      expect(mockRequestRepo.update).toHaveBeenCalledWith('req-1', { billingCode: 'ORGCODE' });
      expect(mockSquareRepo.cancelInvoice).toHaveBeenCalledWith('inv-old');
      // upsertOrder delegates to handleOrganizationBilling which uses calculateOrder
      expect(mockSquareRepo.calculateOrder).toHaveBeenCalled();
      expect(mockPaymentRepo.savePayment).toHaveBeenCalledWith(
        'req-1',
        expect.objectContaining({ organizationId: 'org-1' }),
      );
    });

    // === No code -> Discount-only code ===

    it('none -> discount code: should cancel old invoice and create new invoice with discount applied', async () => {
      const mockRequest = {
        id: 'req-1',
        customerName: 'John Doe',
        email: 'john@example.com',
        billingCode: null,
        payment: { id: 'pay-1', status: 'pending', squareInvoiceId: 'inv-old' },
        materialCost: 5000,
        buildplateCount: 1,
        isQuote: false,
      } as unknown as PrintRequestDto;

      const discountCode = {
        billingCode: { id: 'bc-disc', code: 'SAVE20', discountId: 'disc-20', organizationId: null },
        organization: null,
      };

      const updatedRequest = { ...mockRequest, billingCode: 'SAVE20' };

      vi.mocked(mockRequestRepo.getById)
        .mockResolvedValueOnce(mockRequest)
        .mockResolvedValueOnce(updatedRequest)
        .mockResolvedValueOnce(updatedRequest);

      vi.mocked(mockBillingCodeRepo.getByCode).mockResolvedValue(discountCode);
      vi.mocked(mockRequestRepo.update).mockResolvedValue([]);
      vi.mocked(mockSquareRepo.cancelInvoice).mockResolvedValue(undefined);
      setupUpsertOrderMocks();

      await printPaymentService.updatePrintRequestDiscount('req-1', { billingCode: 'SAVE20' });

      expect(mockSquareRepo.cancelInvoice).toHaveBeenCalledWith('inv-old');
      expect(mockSquareRepo.createOrder).toHaveBeenCalled();
      // Verify discount was included in the order
      const orderCall = vi.mocked(mockSquareRepo.createOrder).mock.calls[0][0];
      expect(orderCall.order.discounts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ catalogObjectId: 'disc-20' }),
        ]),
      );
      expect(mockPaymentRepo.savePayment).toHaveBeenCalled();
    });

    // === Org code -> Different org code ===

    it('org A -> org B: should switch organization billing to new org', async () => {
      const mockRequest = {
        id: 'req-1',
        customerName: 'John Doe',
        email: 'john@example.com',
        billingCode: 'ORG_A',
        payment: { id: 'pay-1', status: 'pending', squareInvoiceId: null, organizationId: 'org-a' },
        materialCost: 5000,
        buildplateCount: 1,
        isQuote: false,
      } as unknown as PrintRequestDto;

      const orgBCode = {
        billingCode: { id: 'bc-org-b', code: 'ORG_B', discountId: null, organizationId: 'org-b' },
        organization: { id: 'org-b', name: 'Org B' },
      };

      const updatedRequest = { ...mockRequest, billingCode: 'ORG_B' };

      vi.mocked(mockRequestRepo.getById)
        .mockResolvedValueOnce(mockRequest)
        .mockResolvedValueOnce(updatedRequest)
        .mockResolvedValueOnce(updatedRequest);

      vi.mocked(mockBillingCodeRepo.getByCode).mockResolvedValue(orgBCode);
      vi.mocked(mockBillingCodeRepo.getById).mockResolvedValue(orgBCode);
      vi.mocked(mockRequestRepo.update).mockResolvedValue([]);
      setupUpsertOrderMocks();

      await printPaymentService.updatePrintRequestDiscount('req-1', { billingCode: 'ORG_B' });

      expect(mockSquareRepo.cancelInvoice).not.toHaveBeenCalled(); // no squareInvoiceId
      expect(mockPaymentRepo.savePayment).toHaveBeenCalledWith(
        'req-1',
        expect.objectContaining({ organizationId: 'org-b' }),
      );
    });

    // === Org code -> Discount-only code ===

    it('org code -> discount code: should switch from org billing to Square invoice with discount', async () => {
      const mockRequest = {
        id: 'req-1',
        customerName: 'John Doe',
        email: 'john@example.com',
        billingCode: 'ORGCODE',
        payment: { id: 'pay-1', status: 'pending', squareInvoiceId: null, organizationId: 'org-1' },
        materialCost: 5000,
        buildplateCount: 1,
        isQuote: false,
      } as unknown as PrintRequestDto;

      const discountCode = {
        billingCode: { id: 'bc-disc', code: 'SAVE20', discountId: 'disc-20', organizationId: null },
        organization: null,
      };

      const updatedRequest = { ...mockRequest, billingCode: 'SAVE20' };

      vi.mocked(mockRequestRepo.getById)
        .mockResolvedValueOnce(mockRequest)
        .mockResolvedValueOnce(updatedRequest)
        .mockResolvedValueOnce(updatedRequest);

      vi.mocked(mockBillingCodeRepo.getByCode).mockResolvedValue(discountCode);
      vi.mocked(mockRequestRepo.update).mockResolvedValue([]);
      setupUpsertOrderMocks();

      await printPaymentService.updatePrintRequestDiscount('req-1', { billingCode: 'SAVE20' });

      expect(mockSquareRepo.createOrder).toHaveBeenCalled();
      expect(mockPaymentRepo.createInvoice).toHaveBeenCalled();
      expect(mockSquareRepo.sendInvoice).toHaveBeenCalled();
      // Verify discount
      const orderCall = vi.mocked(mockSquareRepo.createOrder).mock.calls[0][0];
      expect(orderCall.order.discounts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ catalogObjectId: 'disc-20' }),
        ]),
      );
    });

    // === Org code -> No code ===

    it('org code -> none: should switch from org billing to regular Square invoice', async () => {
      const mockRequest = {
        id: 'req-1',
        customerName: 'John Doe',
        email: 'john@example.com',
        billingCode: 'ORGCODE',
        payment: { id: 'pay-1', status: 'pending', squareInvoiceId: null, organizationId: 'org-1' },
        materialCost: 5000,
        buildplateCount: 1,
        isQuote: false,
      } as unknown as PrintRequestDto;

      const updatedRequest = { ...mockRequest, billingCode: null };

      vi.mocked(mockRequestRepo.getById)
        .mockResolvedValueOnce(mockRequest)
        .mockResolvedValueOnce(updatedRequest)
        .mockResolvedValueOnce(updatedRequest);

      vi.mocked(mockRequestRepo.update).mockResolvedValue([]);
      setupUpsertOrderMocks();

      await printPaymentService.updatePrintRequestDiscount('req-1', { billingCode: '' });

      expect(mockSquareRepo.createOrder).toHaveBeenCalled();
      expect(mockPaymentRepo.createInvoice).toHaveBeenCalled();
      expect(mockSquareRepo.sendInvoice).toHaveBeenCalled();
      // No discounts for a code-less request (assuming non-member)
      const orderCall = vi.mocked(mockSquareRepo.createOrder).mock.calls[0][0];
      expect(orderCall.order.discounts).toHaveLength(0);
    });

    // === Discount code -> Org code ===

    it('discount code -> org code: should cancel Square invoice and create org billing', async () => {
      const mockRequest = {
        id: 'req-1',
        customerName: 'John Doe',
        email: 'john@example.com',
        billingCode: 'SAVE20',
        payment: { id: 'pay-1', status: 'pending', squareInvoiceId: 'inv-old' },
        materialCost: 5000,
        buildplateCount: 1,
        isQuote: false,
      } as unknown as PrintRequestDto;

      const orgCode = {
        billingCode: { id: 'bc-org', code: 'ORGCODE', discountId: 'disc-org', organizationId: 'org-1' },
        organization: { id: 'org-1', name: 'Test Org' },
      };

      const updatedRequest = { ...mockRequest, billingCode: 'ORGCODE' };

      vi.mocked(mockRequestRepo.getById)
        .mockResolvedValueOnce(mockRequest)
        .mockResolvedValueOnce(updatedRequest)
        .mockResolvedValueOnce(updatedRequest);

      vi.mocked(mockBillingCodeRepo.getByCode).mockResolvedValue(orgCode);
      vi.mocked(mockBillingCodeRepo.getById).mockResolvedValue(orgCode);
      vi.mocked(mockRequestRepo.update).mockResolvedValue([]);
      vi.mocked(mockSquareRepo.cancelInvoice).mockResolvedValue(undefined);
      setupUpsertOrderMocks();

      await printPaymentService.updatePrintRequestDiscount('req-1', { billingCode: 'ORGCODE' });

      expect(mockSquareRepo.cancelInvoice).toHaveBeenCalledWith('inv-old');
      expect(mockSquareRepo.calculateOrder).toHaveBeenCalled();
      expect(mockPaymentRepo.savePayment).toHaveBeenCalledWith(
        'req-1',
        expect.objectContaining({ organizationId: 'org-1' }),
      );
    });

    // === Discount code -> No code ===

    it('discount code -> none: should cancel old invoice and create new invoice without discount', async () => {
      const mockRequest = {
        id: 'req-1',
        customerName: 'John Doe',
        email: 'john@example.com',
        billingCode: 'SAVE20',
        payment: { id: 'pay-1', status: 'pending', squareInvoiceId: 'inv-old' },
        materialCost: 5000,
        buildplateCount: 1,
        isQuote: false,
      } as unknown as PrintRequestDto;

      const updatedRequest = { ...mockRequest, billingCode: null };

      vi.mocked(mockRequestRepo.getById)
        .mockResolvedValueOnce(mockRequest)
        .mockResolvedValueOnce(updatedRequest)
        .mockResolvedValueOnce(updatedRequest);

      vi.mocked(mockRequestRepo.update).mockResolvedValue([]);
      vi.mocked(mockSquareRepo.cancelInvoice).mockResolvedValue(undefined);
      setupUpsertOrderMocks();

      await printPaymentService.updatePrintRequestDiscount('req-1', { billingCode: '' });

      expect(mockSquareRepo.cancelInvoice).toHaveBeenCalledWith('inv-old');
      expect(mockSquareRepo.createOrder).toHaveBeenCalled();
      const orderCall = vi.mocked(mockSquareRepo.createOrder).mock.calls[0][0];
      expect(orderCall.order.discounts).toHaveLength(0);
    });

    // === Discount code -> Different discount code ===

    it('discount A -> discount B: should cancel old invoice and create new invoice with new discount', async () => {
      const mockRequest = {
        id: 'req-1',
        customerName: 'John Doe',
        email: 'john@example.com',
        billingCode: 'SAVE10',
        payment: { id: 'pay-1', status: 'pending', squareInvoiceId: 'inv-old' },
        materialCost: 5000,
        buildplateCount: 1,
        isQuote: false,
      } as unknown as PrintRequestDto;

      const newDiscountCode = {
        billingCode: { id: 'bc-disc-b', code: 'SAVE30', discountId: 'disc-30', organizationId: null },
        organization: null,
      };

      const updatedRequest = { ...mockRequest, billingCode: 'SAVE30' };

      vi.mocked(mockRequestRepo.getById)
        .mockResolvedValueOnce(mockRequest)
        .mockResolvedValueOnce(updatedRequest)
        .mockResolvedValueOnce(updatedRequest);

      vi.mocked(mockBillingCodeRepo.getByCode).mockResolvedValue(newDiscountCode);
      vi.mocked(mockRequestRepo.update).mockResolvedValue([]);
      vi.mocked(mockSquareRepo.cancelInvoice).mockResolvedValue(undefined);
      setupUpsertOrderMocks();

      await printPaymentService.updatePrintRequestDiscount('req-1', { billingCode: 'SAVE30' });

      expect(mockSquareRepo.cancelInvoice).toHaveBeenCalledWith('inv-old');
      expect(mockSquareRepo.createOrder).toHaveBeenCalled();
      const orderCall = vi.mocked(mockSquareRepo.createOrder).mock.calls[0][0];
      expect(orderCall.order.discounts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ catalogObjectId: 'disc-30' }),
        ]),
      );
    });

    // === Org code with discount -> Different org code ===

    it('org+discount code -> different org code: should reassign to new org', async () => {
      const mockRequest = {
        id: 'req-1',
        customerName: 'John Doe',
        email: 'john@example.com',
        billingCode: 'ORG_A_DISC',
        payment: { id: 'pay-1', status: 'pending', squareInvoiceId: null, organizationId: 'org-a' },
        materialCost: 5000,
        buildplateCount: 1,
        isQuote: false,
      } as unknown as PrintRequestDto;

      const orgBWithDiscount = {
        billingCode: { id: 'bc-org-b', code: 'ORG_B_DISC', discountId: 'disc-b', organizationId: 'org-b' },
        organization: { id: 'org-b', name: 'Org B' },
      };

      const updatedRequest = { ...mockRequest, billingCode: 'ORG_B_DISC' };

      vi.mocked(mockRequestRepo.getById)
        .mockResolvedValueOnce(mockRequest)
        .mockResolvedValueOnce(updatedRequest)
        .mockResolvedValueOnce(updatedRequest);

      vi.mocked(mockBillingCodeRepo.getByCode).mockResolvedValue(orgBWithDiscount);
      vi.mocked(mockBillingCodeRepo.getById).mockResolvedValue(orgBWithDiscount);
      vi.mocked(mockRequestRepo.update).mockResolvedValue([]);
      setupUpsertOrderMocks();

      await printPaymentService.updatePrintRequestDiscount('req-1', { billingCode: 'ORG_B_DISC' });

      expect(mockPaymentRepo.savePayment).toHaveBeenCalledWith(
        'req-1',
        expect.objectContaining({ organizationId: 'org-b' }),
      );
    });

    // === Quote status payment ===

    it('quote payment + add org code: should cancel quote invoice and create org billing', async () => {
      const mockRequest = {
        id: 'req-1',
        customerName: 'John Doe',
        email: 'john@example.com',
        billingCode: null,
        payment: { id: 'pay-1', status: 'quote', squareInvoiceId: 'inv-quote' },
        materialCost: 5000,
        buildplateCount: 1,
        isQuote: true,
      } as unknown as PrintRequestDto;

      const orgCode = {
        billingCode: { id: 'bc-org', code: 'ORGCODE', discountId: null, organizationId: 'org-1' },
        organization: { id: 'org-1', name: 'Test Org' },
      };

      const updatedRequest = { ...mockRequest, billingCode: 'ORGCODE' };

      vi.mocked(mockRequestRepo.getById)
        .mockResolvedValueOnce(mockRequest)
        .mockResolvedValueOnce(updatedRequest)
        .mockResolvedValueOnce(updatedRequest);

      vi.mocked(mockBillingCodeRepo.getByCode).mockResolvedValue(orgCode);
      vi.mocked(mockBillingCodeRepo.getById).mockResolvedValue(orgCode);
      vi.mocked(mockRequestRepo.update).mockResolvedValue([]);
      vi.mocked(mockSquareRepo.cancelInvoice).mockResolvedValue(undefined);
      setupUpsertOrderMocks();

      await printPaymentService.updatePrintRequestDiscount('req-1', { billingCode: 'ORGCODE' });

      expect(mockSquareRepo.cancelInvoice).toHaveBeenCalledWith('inv-quote');
      expect(mockPaymentRepo.savePayment).toHaveBeenCalledWith(
        'req-1',
        expect.objectContaining({ organizationId: 'org-1' }),
      );
    });
  });
});
