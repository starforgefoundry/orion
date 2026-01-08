import type {
  ChargeOrganizationBalanceDto,
  CreateOrganizationDto,
  UpdateOrganizationDto,
} from '$lib/remotes/dtos/organization.dto';
import type { CreateOrgChargeDto } from '$lib/remotes/dtos/organization_charges.dto';
import { BaseService } from '$lib/server/services/base.service';
import { DateTime } from 'luxon';

export class OrganizationService extends BaseService {
  async getOrganizations() {
    return await this.organizationRepository.getAll();
  }

  async getOrganizationById(id: string) {
    return await this.organizationRepository.getById(id);
  }

  async getOrganizationDetail(id: string) {
    const organization = await this.organizationRepository.getById(id);
    if (!organization) {
      throw new Error('Organization not found');
    }

    const [outstandingBalance, printRequests, organizationCharges, balancePayments] =
      await Promise.all([
        this.getOutstandingBalance(id),
        this.organizationRepository.getPrintRequests(id),
        this.organizationRepository.getCharges(id),
        this.organizationRepository.getBalancePayments(id),
      ]);

    // Convert print requests to charges
    const printCharges = printRequests.map((req) => ({
      id: req.id,
      description: `Print Request - ${req.projectName}`,
      date: req.submissionDate.toISO()!,
      amount: req.payment?.total ?? 0,
      status: req.status,
      type: 'print' as const,
    }));

    // Convert organization charges
    const orgCharges = organizationCharges.map((charge) => ({
      id: charge.id,
      description: charge.description,
      date: charge.creationDate.toISO()!,
      amount: charge.payment.total,
      status: 'charged',
      type: 'charge' as const,
    }));

    // Merge and sort by date (newest first)
    const allCharges = [...printCharges, ...orgCharges].sort((a, b) => {
      const dateA = DateTime.fromISO(a.date);
      const dateB = DateTime.fromISO(b.date);
      return dateB.toMillis() - dateA.toMillis();
    });

    return {
      id: organization.id,
      name: organization.name,
      email: organization.email,
      outstandingBalance,
      charges: allCharges,
      balancePayments,
    };
  }

  async createOrganization(data: CreateOrganizationDto) {
    return await this.organizationRepository.create(data);
  }

  async updateOrganization(id: string, updates: Omit<UpdateOrganizationDto, 'id'>) {
    return await this.organizationRepository.update(id, updates);
  }

  async archiveOrganization(id: string) {
    await this.organizationRepository.archive(id);
  }

  async getOutstandingBalance(organizationId: string) {
    const allPayments = await this.organizationRepository.getPayments(organizationId);

    let totalOwed = 0;

    // Add payment charges (print requests)
    for (const row of allPayments) {
      if (row.status !== 'quote' && row.status !== 'canceled' && row.type !== 'balance') {
        totalOwed += row.total;
      }

      if (row.type === 'balance') {
        totalOwed -= row.total;
      }
    }

    return totalOwed;
  }

  async chargeBalance(dto: ChargeOrganizationBalanceDto) {
    const organization = await this.organizationRepository.getById(dto.organizationId);
    if (!organization) {
      throw new Error('Organization not found');
    }

    const outstandingBalance = await this.getOutstandingBalance(dto.organizationId);

    if (outstandingBalance <= 0) {
      throw new Error('No outstanding balance to charge');
    }

    // Get or create the customer in Square
    const customer = await this.squareRepository.upsertCustomer(
      organization.name,
      organization.email,
    );

    // Get Square settings for location
    const squareSettings = await this.settingsRepository.getSetting('printRequestSquare');

    // Create a Square order for the balance
    const order = await this.squareRepository.createOrder({
      order: {
        locationId: squareSettings.locationId,
        customerId: customer.id!,
        lineItems: [
          {
            name: 'Organization Balance Payment',
            quantity: '1',
            basePriceMoney: {
              amount: BigInt(outstandingBalance),
              currency: 'USD',
            },
          },
        ],
      },
    });

    if (!order) {
      throw new Error('Failed to create order in Square');
    }

    // Create an invoice for this order
    const invoice = await this.paymentRepository.createInvoice(order);
    if (!invoice) {
      throw new Error('Failed to create invoice in Square');
    }

    // Send the invoice
    await this.squareRepository.sendInvoice(invoice.id!, invoice.version!);

    // Create a payment record for this balance payment
    const payment = await this.paymentRepository.createStandalonePayment({
      organizationId: dto.organizationId,
      status: 'pending',
      issuedDate: DateTime.now(),
      total: outstandingBalance,
      squareInvoiceId: invoice.id!,
      squareOrderId: order.id!,
      type: 'balance',
    });

    return payment;
  }

  async createCharge(dto: CreateOrgChargeDto) {
    return await this.organizationRepository.createCharge(dto);
  }
}

export const organizationService = new OrganizationService();
