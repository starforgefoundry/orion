import type {
  ChargeOrganizationBalanceDto,
  CreateOrganizationDto,
  UpdateOrganizationDto,
} from '$lib/remotes/dtos/organization.dto';
import { DateTime } from 'luxon';
import type { Customer, Invoice, Order } from 'square';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OrganizationService } from './organization.service';

// Mock remote endpoints to avoid SvelteKit request store errors
vi.mock('$lib/remotes/endpoints/organization.remote', () => ({
  getOrganizations: vi.fn(() => ({
    refresh: vi.fn().mockResolvedValue(undefined),
  })),
  getOrganizationById: vi.fn(() => ({
    refresh: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe('OrganizationService', () => {
  let organizationService: OrganizationService;
  let mockOrganizationRepo: any;
  let mockPaymentRepo: any;
  let mockSettingsRepo: any;
  let mockSquareRepo: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockOrganizationRepo = {
      create: vi.fn(),
      getAll: vi.fn(),
      getById: vi.fn(),
      update: vi.fn(),
      archive: vi.fn(),
      getPayments: vi.fn(),
      getPrintRequests: vi.fn(),
      getCharges: vi.fn(),
      getBalancePayments: vi.fn(),
    };

    mockPaymentRepo = {
      createInvoice: vi.fn(),
      createStandalonePayment: vi.fn(),
    };

    mockSettingsRepo = {
      getSetting: vi.fn(),
    };

    mockSquareRepo = {
      upsertCustomer: vi.fn(),
      createOrder: vi.fn(),
      sendInvoice: vi.fn(),
    };

    organizationService = new OrganizationService(
      undefined,
      undefined,
      undefined,
      mockPaymentRepo,
      mockSettingsRepo,
      mockSquareRepo,
      undefined,
      undefined,
      mockOrganizationRepo,
      undefined,
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getOrganizations', () => {
    it('should return all non-archived organizations', async () => {
      // Arrange
      const mockOrganizations = [
        {
          id: 'org-1',
          name: 'Organization 1',
          email: 'org1@test.com',
          archived: false,
        },
        {
          id: 'org-2',
          name: 'Organization 2',
          email: 'org2@test.com',
          archived: false,
        },
      ];

      vi.mocked(mockOrganizationRepo.getAll).mockResolvedValue(mockOrganizations);

      // Act
      const result = await organizationService.getOrganizations();

      // Assert
      expect(mockOrganizationRepo.getAll).toHaveBeenCalled();
      expect(result).toEqual(mockOrganizations);
    });

    it('should return empty array when no organizations exist', async () => {
      // Arrange
      vi.mocked(mockOrganizationRepo.getAll).mockResolvedValue([]);

      // Act
      const result = await organizationService.getOrganizations();

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('getOrganizationById', () => {
    it('should return organization by id', async () => {
      // Arrange
      const mockOrganization = {
        id: 'org-123',
        name: 'Test Organization',
        email: 'test@org.com',
        archived: false,
      };

      vi.mocked(mockOrganizationRepo.getById).mockResolvedValue(mockOrganization);

      // Act
      const result = await organizationService.getOrganizationById('org-123');

      // Assert
      expect(mockOrganizationRepo.getById).toHaveBeenCalledWith('org-123');
      expect(result).toEqual(mockOrganization);
    });

    it('should return null when organization not found', async () => {
      // Arrange
      vi.mocked(mockOrganizationRepo.getById).mockResolvedValue(null);

      // Act
      const result = await organizationService.getOrganizationById('nonexistent');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('getOrganizationDetail', () => {
    it('should return organization detail with outstanding balance, print requests, and payments', async () => {
      // Arrange
      const mockOrganization = {
        id: 'org-detail',
        name: 'Detail Org',
        email: 'detail@org.com',
        archived: false,
      };

      const mockPrintRequests = [
        {
          id: 'request-1',
          customerName: 'Customer 1',
          email: 'customer1@test.com',
          status: 'completed',
          projectName: 'Project 1',
          submissionDate: DateTime.now(),
          payment: {
            id: 'payment-1',
            total: 5000,
            status: 'pending',
          },
        },
        {
          id: 'request-2',
          customerName: 'Customer 2',
          email: 'customer2@test.com',
          status: 'in_queue',
          projectName: 'Project 2',
          submissionDate: DateTime.now(),
          payment: {
            id: 'payment-2',
            total: 3000,
            status: 'pending',
          },
        },
      ];

      const mockBalancePayments = [
        {
          id: 'balance-payment-1',
          total: 2000,
          status: 'paid',
          type: 'balance',
        },
      ];

      const mockOrgCharges = [
        {
          id: 'charge-1',
          organizationId: 'org-detail',
          description: 'Misc Charge',
          amount: 1000,
          creationDate: DateTime.now(),
          payment: {
            id: 'charge-payment-1',
            total: 1000,
            status: 'paid',
            type: 'organization_charge',
          },
        },
      ];

      const mockPayments = [
        {
          id: 'payment-1',
          total: 5000,
          status: 'paid',
          type: 'print',
        },
        {
          id: 'payment-2',
          total: 3000,
          status: 'paid',
          type: 'print',
        },
        {
          id: 'balance-payment-1',
          total: 2000,
          status: 'paid',
          type: 'balance',
        },
        {
          id: 'charge-payment-1',
          total: 1000,
          status: 'paid',
          type: 'organization_charge',
        },
      ];

      vi.mocked(mockOrganizationRepo.getById).mockResolvedValue(mockOrganization);
      vi.mocked(mockOrganizationRepo.getPayments).mockResolvedValue(mockPayments);
      vi.mocked(mockOrganizationRepo.getPrintRequests).mockResolvedValue(mockPrintRequests);
      vi.mocked(mockOrganizationRepo.getCharges).mockResolvedValue(mockOrgCharges);
      vi.mocked(mockOrganizationRepo.getBalancePayments).mockResolvedValue(mockBalancePayments);

      // Act
      const result = await organizationService.getOrganizationDetail('org-detail');

      // Assert
      expect(mockOrganizationRepo.getById).toHaveBeenCalledWith('org-detail');
      expect(mockOrganizationRepo.getPayments).toHaveBeenCalledWith('org-detail');
      expect(mockOrganizationRepo.getPrintRequests).toHaveBeenCalledWith('org-detail');
      expect(mockOrganizationRepo.getCharges).toHaveBeenCalledWith('org-detail');
      expect(mockOrganizationRepo.getBalancePayments).toHaveBeenCalledWith('org-detail');
      expect(result.id).toBe('org-detail');
      expect(result.name).toBe('Detail Org');
      expect(result.email).toBe('detail@org.com');
      expect(result.outstandingBalance).toBe(7000);
      expect(result.charges).toHaveLength(3); // 2 print requests + 1 org charge
      expect(result.charges.some((c) => c.type === 'print')).toBe(true);
      expect(result.charges.some((c) => c.type === 'charge')).toBe(true);
      expect(result.balancePayments).toEqual(mockBalancePayments);
    });

    it('should throw error when organization not found', async () => {
      // Arrange
      vi.mocked(mockOrganizationRepo.getById).mockResolvedValue(null);

      // Act & Assert
      await expect(organizationService.getOrganizationDetail('nonexistent')).rejects.toThrow(
        'Organization not found',
      );
    });

    it('should return organization detail with zero balance when no payments exist', async () => {
      // Arrange
      const mockOrganization = {
        id: 'org-zero',
        name: 'Zero Balance Org',
        email: 'zero@org.com',
        archived: false,
      };

      vi.mocked(mockOrganizationRepo.getById).mockResolvedValue(mockOrganization);
      vi.mocked(mockOrganizationRepo.getPayments).mockResolvedValue([]);
      vi.mocked(mockOrganizationRepo.getPrintRequests).mockResolvedValue([]);
      vi.mocked(mockOrganizationRepo.getCharges).mockResolvedValue([]);
      vi.mocked(mockOrganizationRepo.getBalancePayments).mockResolvedValue([]);

      // Act
      const result = await organizationService.getOrganizationDetail('org-zero');

      // Assert
      expect(result.outstandingBalance).toBe(0);
      expect(result.charges).toEqual([]);
      expect(result.balancePayments).toEqual([]);
    });
  });

  describe('createOrganization', () => {
    it('should create a new organization', async () => {
      // Arrange
      const dto: CreateOrganizationDto = {
        name: 'New Organization',
        email: 'new@org.com',
      };

      const mockCreated = {
        id: 'org-new',
        name: 'New Organization',
        email: 'new@org.com',
        archived: false,
      };

      vi.mocked(mockOrganizationRepo.create).mockResolvedValue(mockCreated);

      // Act
      const result = await organizationService.createOrganization(dto);

      // Assert
      expect(mockOrganizationRepo.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockCreated);
    });
  });

  describe('updateOrganization', () => {
    it('should update an existing organization', async () => {
      // Arrange
      const updates: Omit<UpdateOrganizationDto, 'id'> = {
        name: 'Updated Name',
        email: 'updated@org.com',
      };

      const mockUpdated = {
        id: 'org-update',
        name: 'Updated Name',
        email: 'updated@org.com',
        archived: false,
      };

      vi.mocked(mockOrganizationRepo.update).mockResolvedValue(mockUpdated);

      // Act
      const result = await organizationService.updateOrganization('org-update', updates);

      // Assert
      expect(mockOrganizationRepo.update).toHaveBeenCalledWith('org-update', updates);
      expect(result).toEqual(mockUpdated);
    });

    it('should update only email', async () => {
      // Arrange
      const updates: Omit<UpdateOrganizationDto, 'id'> = {
        email: 'newemail@org.com',
      };

      const mockUpdated = {
        id: 'org-email',
        name: 'Same Name',
        email: 'newemail@org.com',
        archived: false,
      };

      vi.mocked(mockOrganizationRepo.update).mockResolvedValue(mockUpdated);

      // Act
      const result = await organizationService.updateOrganization('org-email', updates);

      // Assert
      expect(mockOrganizationRepo.update).toHaveBeenCalledWith('org-email', updates);
      expect(result.email).toBe('newemail@org.com');
    });
  });

  describe('archiveOrganization', () => {
    it('should archive an organization', async () => {
      // Arrange
      vi.mocked(mockOrganizationRepo.archive).mockResolvedValue(undefined);

      // Act
      await organizationService.archiveOrganization('org-archive');

      // Assert
      expect(mockOrganizationRepo.archive).toHaveBeenCalledWith('org-archive');
    });
  });

  describe('getOutstandingBalance', () => {
    it('should calculate outstanding balance correctly with paid print requests', async () => {
      // Arrange
      const mockPayments = [
        { id: 'p1', total: 5000, status: 'paid', type: 'print' },
        { id: 'p2', total: 3000, status: 'paid', type: 'print' },
      ];

      vi.mocked(mockOrganizationRepo.getPayments).mockResolvedValue(mockPayments);
      vi.mocked(mockOrganizationRepo.getCharges).mockResolvedValue([]);

      // Act
      const result = await organizationService.getOutstandingBalance('org-123');

      // Assert
      expect(mockOrganizationRepo.getPayments).toHaveBeenCalledWith('org-123');
      expect(result).toBe(8000); // 5000 + 3000
    });

    it('should subtract balance payments from outstanding balance', async () => {
      // Arrange
      const mockPayments = [
        { id: 'p1', total: 5000, status: 'paid', type: 'print' },
        { id: 'p2', total: 3000, status: 'paid', type: 'print' },
        { id: 'p3', total: 2000, status: 'paid', type: 'balance' },
      ];

      vi.mocked(mockOrganizationRepo.getPayments).mockResolvedValue(mockPayments);
      vi.mocked(mockOrganizationRepo.getCharges).mockResolvedValue([]);

      // Act
      const result = await organizationService.getOutstandingBalance('org-123');

      // Assert
      expect(result).toBe(6000); // 5000 + 3000 - 2000
    });

    it('should only count non quote or canceled payments', async () => {
      // Arrange
      const mockPayments = [
        { id: 'p1', total: 5000, status: 'paid', type: 'print' },
        { id: 'p2', total: 3000, status: 'pending', type: 'print' },
        { id: 'p3', total: 4000, status: 'quote', type: 'print' },
        { id: 'p4', total: 2000, status: 'canceled', type: 'print' },
      ];

      vi.mocked(mockOrganizationRepo.getPayments).mockResolvedValue(mockPayments);
      vi.mocked(mockOrganizationRepo.getCharges).mockResolvedValue([]);

      // Act
      const result = await organizationService.getOutstandingBalance('org-123');

      // Assert
      expect(result).toBe(8000); // Only paid payment counts
    });

    it('should return 0 when no payments exist', async () => {
      // Arrange
      vi.mocked(mockOrganizationRepo.getPayments).mockResolvedValue([]);
      vi.mocked(mockOrganizationRepo.getCharges).mockResolvedValue([]);

      // Act
      const result = await organizationService.getOutstandingBalance('org-empty');

      // Assert
      expect(result).toBe(0);
    });

    it('should return negative balance when balance payments exceed print payments', async () => {
      // Arrange
      const mockPayments = [
        { id: 'p1', total: 1000, status: 'paid', type: 'print' },
        { id: 'p2', total: 2000, status: 'paid', type: 'balance' },
      ];

      vi.mocked(mockOrganizationRepo.getPayments).mockResolvedValue(mockPayments);
      vi.mocked(mockOrganizationRepo.getCharges).mockResolvedValue([]);

      // Act
      const result = await organizationService.getOutstandingBalance('org-overpaid');

      // Assert
      expect(result).toBe(-1000); // 1000 - 2000
    });

    it('should handle multiple balance payments', async () => {
      // Arrange
      const mockPayments = [
        { id: 'p1', total: 10000, status: 'paid', type: 'print' },
        { id: 'p2', total: 3000, status: 'paid', type: 'balance' },
        { id: 'p3', total: 2000, status: 'paid', type: 'balance' },
        { id: 'p4', total: 5000, status: 'paid', type: 'print' },
      ];

      vi.mocked(mockOrganizationRepo.getPayments).mockResolvedValue(mockPayments);
      vi.mocked(mockOrganizationRepo.getCharges).mockResolvedValue([]);

      // Act
      const result = await organizationService.getOutstandingBalance('org-multi');

      // Assert
      expect(result).toBe(10000); // (10000 + 5000) - (3000 + 2000)
    });

    it('should include organization charges in outstanding balance', async () => {
      // Arrange
      const mockPayments = [
        { id: 'p1', total: 5000, status: 'paid', type: 'print' },
        { id: 'p2', total: 2000, status: 'paid', type: 'balance' },
        { id: 'charge-payment-1', total: 1500, status: 'paid', type: 'charge' },
        { id: 'charge-payment-2', total: 500, status: 'paid', type: 'charge' },
      ];

      vi.mocked(mockOrganizationRepo.getPayments).mockResolvedValue(mockPayments);

      // Act
      const result = await organizationService.getOutstandingBalance('org-123');

      // Assert
      expect(result).toBe(5000); // 5000 - 2000 + 1500 + 500
    });
  });

  describe('chargeOrganizationBalance', () => {
    it('should create invoice and payment for organization balance', async () => {
      // Arrange
      const dto: ChargeOrganizationBalanceDto = {
        organizationId: 'org-charge',
      };

      const mockOrganization = {
        id: 'org-charge',
        name: 'Charge Org',
        email: 'charge@org.com',
        archived: false,
      };

      const mockCustomer: Customer = {
        id: 'customer-charge',
        emailAddress: 'charge@org.com',
      };

      const mockSquareSettings = {
        locationId: 'loc-123',
        printRequestItemId: 'item-123',
        additionalBuildPlateItemId: 'plate-456',
        memberPrintDiscountId: 'discount-789',
      };

      const mockOrder: Order = {
        id: 'order-balance',
        locationId: 'loc-123',
        netAmountDueMoney: { amount: BigInt(8000), currency: 'USD' },
      };

      const mockInvoice: Invoice = {
        id: 'inv-balance',
        version: 1,
        createdAt: DateTime.now().toISO(),
      };

      const mockPayment = {
        id: 'payment-balance',
        organizationId: 'org-charge',
        status: 'pending',
        total: 8000,
        squareInvoiceId: 'inv-balance',
        squareOrderId: 'order-balance',
        type: 'balance',
      };

      const mockPayments = [
        { id: 'p1', total: 5000, status: 'paid', type: 'print' },
        { id: 'p2', total: 3000, status: 'paid', type: 'print' },
      ];

      vi.mocked(mockOrganizationRepo.getById).mockResolvedValue(mockOrganization);
      vi.mocked(mockOrganizationRepo.getPayments).mockResolvedValue(mockPayments);
      vi.mocked(mockOrganizationRepo.getCharges).mockResolvedValue([]);
      vi.mocked(mockSquareRepo.upsertCustomer).mockResolvedValue(mockCustomer);
      vi.mocked(mockSettingsRepo.getSetting).mockResolvedValue(mockSquareSettings);
      vi.mocked(mockSquareRepo.createOrder).mockResolvedValue(mockOrder);
      vi.mocked(mockPaymentRepo.createInvoice).mockResolvedValue(mockInvoice);
      vi.mocked(mockSquareRepo.sendInvoice).mockResolvedValue(undefined);
      vi.mocked(mockPaymentRepo.createStandalonePayment).mockResolvedValue(mockPayment);

      // Act
      const result = await organizationService.chargeBalance(dto);

      // Assert
      expect(mockOrganizationRepo.getById).toHaveBeenCalledWith('org-charge');
      expect(mockOrganizationRepo.getPayments).toHaveBeenCalledWith('org-charge');
      expect(mockSquareRepo.upsertCustomer).toHaveBeenCalledWith('Charge Org', 'charge@org.com');
      expect(mockSettingsRepo.getSetting).toHaveBeenCalledWith('printRequestSquare');
      expect(mockSquareRepo.createOrder).toHaveBeenCalledWith({
        order: {
          locationId: 'loc-123',
          customerId: 'customer-charge',
          lineItems: [
            {
              name: 'Organization Balance Payment',
              quantity: '1',
              basePriceMoney: {
                amount: BigInt(8000),
                currency: 'USD',
              },
            },
          ],
        },
      });
      expect(mockPaymentRepo.createInvoice).toHaveBeenCalledWith(mockOrder);
      expect(mockSquareRepo.sendInvoice).toHaveBeenCalledWith('inv-balance', 1);
      expect(mockPaymentRepo.createStandalonePayment).toHaveBeenCalledWith({
        organizationId: 'org-charge',
        status: 'pending',
        issuedDate: expect.any(DateTime),
        total: 8000,
        squareInvoiceId: 'inv-balance',
        squareOrderId: 'order-balance',
        type: 'balance',
      });
      expect(result).toEqual(mockPayment);
    });

    it('should throw error when organization not found', async () => {
      // Arrange
      const dto: ChargeOrganizationBalanceDto = {
        organizationId: 'nonexistent',
      };

      vi.mocked(mockOrganizationRepo.getById).mockResolvedValue(null);

      // Act & Assert
      await expect(organizationService.chargeBalance(dto)).rejects.toThrow(
        'Organization not found',
      );
    });

    it('should throw error when no outstanding balance exists', async () => {
      // Arrange
      const dto: ChargeOrganizationBalanceDto = {
        organizationId: 'org-no-balance',
      };

      const mockOrganization = {
        id: 'org-no-balance',
        name: 'No Balance Org',
        email: 'nobalance@org.com',
        archived: false,
      };

      const mockPaymentsNegative = [
        { id: 'p1', total: 1000, status: 'paid', type: 'print' },
        { id: 'p2', total: 2000, status: 'paid', type: 'balance' },
      ];

      vi.mocked(mockOrganizationRepo.getById).mockResolvedValue(mockOrganization);
      vi.mocked(mockOrganizationRepo.getPayments).mockResolvedValue(mockPaymentsNegative);
      vi.mocked(mockOrganizationRepo.getCharges).mockResolvedValue([]);

      // Act & Assert
      await expect(organizationService.chargeBalance(dto)).rejects.toThrow(
        'No outstanding balance to charge',
      );
    });

    it('should throw error when outstanding balance is negative', async () => {
      // Arrange
      const dto: ChargeOrganizationBalanceDto = {
        organizationId: 'org-negative',
      };

      const mockOrganization = {
        id: 'org-negative',
        name: 'Negative Balance Org',
        email: 'negative@org.com',
        archived: false,
      };

      const mockPaymentsNegative = [
        { id: 'p1', total: 1000, status: 'paid', type: 'print' },
        { id: 'p2', total: 2000, status: 'paid', type: 'balance' },
      ];

      vi.mocked(mockOrganizationRepo.getById).mockResolvedValue(mockOrganization);
      vi.mocked(mockOrganizationRepo.getPayments).mockResolvedValue(mockPaymentsNegative);
      vi.mocked(mockOrganizationRepo.getCharges).mockResolvedValue([]);

      // Act & Assert
      await expect(organizationService.chargeBalance(dto)).rejects.toThrow(
        'No outstanding balance to charge',
      );
    });

    it('should throw error when order creation fails', async () => {
      // Arrange
      const dto: ChargeOrganizationBalanceDto = {
        organizationId: 'org-fail-order',
      };

      const mockOrganization = {
        id: 'org-fail-order',
        name: 'Fail Order Org',
        email: 'failorder@org.com',
        archived: false,
      };

      const mockCustomer: Customer = {
        id: 'customer-fail',
        emailAddress: 'failorder@org.com',
      };

      const mockSquareSettings = {
        locationId: 'loc-123',
        printRequestItemId: 'item-123',
        additionalBuildPlateItemId: 'plate-456',
        memberPrintDiscountId: 'discount-789',
      };

      const mockPaymentsOrder = [{ id: 'p1', total: 5000, status: 'paid', type: 'print' }];

      vi.mocked(mockOrganizationRepo.getById).mockResolvedValue(mockOrganization);
      vi.mocked(mockOrganizationRepo.getPayments).mockResolvedValue(mockPaymentsOrder);
      vi.mocked(mockOrganizationRepo.getCharges).mockResolvedValue([]);
      vi.mocked(mockSquareRepo.upsertCustomer).mockResolvedValue(mockCustomer);
      vi.mocked(mockSettingsRepo.getSetting).mockResolvedValue(mockSquareSettings);
      vi.mocked(mockSquareRepo.createOrder).mockResolvedValue(null);

      // Act & Assert
      await expect(organizationService.chargeBalance(dto)).rejects.toThrow(
        'Failed to create order in Square',
      );
    });

    it('should throw error when invoice creation fails', async () => {
      // Arrange
      const dto: ChargeOrganizationBalanceDto = {
        organizationId: 'org-fail-invoice',
      };

      const mockOrganization = {
        id: 'org-fail-invoice',
        name: 'Fail Invoice Org',
        email: 'failinvoice@org.com',
        archived: false,
      };

      const mockCustomer: Customer = {
        id: 'customer-fail-inv',
        emailAddress: 'failinvoice@org.com',
      };

      const mockSquareSettings = {
        locationId: 'loc-123',
        printRequestItemId: 'item-123',
        additionalBuildPlateItemId: 'plate-456',
        memberPrintDiscountId: 'discount-789',
      };

      const mockPaymentsInvoice = [{ id: 'p1', total: 5000, status: 'paid', type: 'print' }];

      const mockOrder: Order = {
        id: 'order-fail-inv',
        locationId: 'loc-123',
        netAmountDueMoney: { amount: BigInt(5000), currency: 'USD' },
      };

      vi.mocked(mockOrganizationRepo.getById).mockResolvedValue(mockOrganization);
      vi.mocked(mockOrganizationRepo.getPayments).mockResolvedValue(mockPaymentsInvoice);
      vi.mocked(mockOrganizationRepo.getCharges).mockResolvedValue([]);
      vi.mocked(mockSquareRepo.upsertCustomer).mockResolvedValue(mockCustomer);
      vi.mocked(mockSettingsRepo.getSetting).mockResolvedValue(mockSquareSettings);
      vi.mocked(mockSquareRepo.createOrder).mockResolvedValue(mockOrder);
      vi.mocked(mockPaymentRepo.createInvoice).mockResolvedValue(null);

      // Act & Assert
      await expect(organizationService.chargeBalance(dto)).rejects.toThrow(
        'Failed to create invoice in Square',
      );
    });

    it('should handle large outstanding balance', async () => {
      // Arrange
      const dto: ChargeOrganizationBalanceDto = {
        organizationId: 'org-large',
      };

      const mockOrganization = {
        id: 'org-large',
        name: 'Large Balance Org',
        email: 'large@org.com',
        archived: false,
      };

      const mockCustomer: Customer = {
        id: 'customer-large',
        emailAddress: 'large@org.com',
      };

      const mockSquareSettings = {
        locationId: 'loc-123',
        printRequestItemId: 'item-123',
        additionalBuildPlateItemId: 'plate-456',
        memberPrintDiscountId: 'discount-789',
      };

      const largeBalance = 100000; // $1000.00

      const mockOrder: Order = {
        id: 'order-large',
        locationId: 'loc-123',
        netAmountDueMoney: { amount: BigInt(largeBalance), currency: 'USD' },
      };

      const mockInvoice: Invoice = {
        id: 'inv-large',
        version: 1,
        createdAt: DateTime.now().toISO(),
      };

      const mockPayment = {
        id: 'payment-large',
        organizationId: 'org-large',
        status: 'pending',
        total: largeBalance,
        squareInvoiceId: 'inv-large',
        squareOrderId: 'order-large',
        type: 'balance',
      };

      const mockLargePayments = [
        { id: 'p1', total: 60000, status: 'paid', type: 'print' },
        { id: 'p2', total: 40000, status: 'paid', type: 'print' },
      ];

      vi.mocked(mockOrganizationRepo.getById).mockResolvedValue(mockOrganization);
      vi.mocked(mockOrganizationRepo.getPayments).mockResolvedValue(mockLargePayments);
      vi.mocked(mockOrganizationRepo.getCharges).mockResolvedValue([]);
      vi.mocked(mockSquareRepo.upsertCustomer).mockResolvedValue(mockCustomer);
      vi.mocked(mockSettingsRepo.getSetting).mockResolvedValue(mockSquareSettings);
      vi.mocked(mockSquareRepo.createOrder).mockResolvedValue(mockOrder);
      vi.mocked(mockPaymentRepo.createInvoice).mockResolvedValue(mockInvoice);
      vi.mocked(mockSquareRepo.sendInvoice).mockResolvedValue(undefined);
      vi.mocked(mockPaymentRepo.createStandalonePayment).mockResolvedValue(mockPayment);

      // Act
      const result = await organizationService.chargeBalance(dto);

      // Assert
      expect(result.total).toBe(largeBalance);
      const orderCall = vi.mocked(mockSquareRepo.createOrder).mock.calls[0][0];
      expect(orderCall.order.lineItems![0].basePriceMoney!.amount).toBe(BigInt(largeBalance));
    });
  });
});
