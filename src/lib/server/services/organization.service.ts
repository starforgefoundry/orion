import type {
  AddOrganizationMembersDto,
  ChargeOrganizationBalanceDto,
  CreateOrganizationDto,
  UpdateOrganizationDto,
} from '$lib/remotes/dtos/organization.dto';
import type { CreateOrgChargeDto } from '$lib/remotes/dtos/organization_charges.dto';
import { MEMBER_EMAIL_TRIGGER } from '$lib/member_enums';
import type { Member } from '$lib/server/db/schema';
import { MailgunRateLimitError } from '$lib/server/repositories/mailgun.repository';
import { BaseService } from '$lib/server/services/base.service';
import { runInBackground } from '$lib/server/utils/background';
import { SPACE_ZONE } from '$lib/server/utils/member_access';
import { parseMemberLines, type ParsedMemberLine } from '$lib/server/utils/member_lines';
import { DateTime } from 'luxon';

export const ORGANIZATION_NOT_FOUND = 'Organization not found';
const MAX_RATE_LIMIT_ATTEMPTS = 5;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Access lasts through the whole chosen day in the space's time zone. */
export function accessEndOfDay(date: string | null) {
  return date === null ? null : DateTime.fromISO(date, { zone: SPACE_ZONE }).endOf('day');
}

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
      grantsAccess: organization.grantsAccess,
      accessEndDate: organization.accessEndDate,
      outstandingBalance,
      charges: allCharges,
      balancePayments,
    };
  }

  async createOrganization(data: CreateOrganizationDto) {
    return await this.organizationRepository.create(data);
  }

  async updateOrganization(id: string, updates: Omit<UpdateOrganizationDto, 'id'>) {
    const { accessEndDate, ...rest } = updates;
    return await this.organizationRepository.update(id, {
      ...rest,
      ...(accessEndDate !== undefined && { accessEndDate: accessEndOfDay(accessEndDate) }),
    });
  }

  async listOrganizationMembers(organizationId: string) {
    return await this.organizationMemberRepository.listByOrganization(organizationId);
  }

  async removeOrganizationMembers(organizationId: string, membershipIds: string[]) {
    await this.organizationMemberRepository.removeMany(organizationId, membershipIds);
  }

  /** Members already in the organization are skipped and not emailed again. */
  async addOrganizationMembers(dto: AddOrganizationMembersDto) {
    const organization = await this.organizationRepository.getById(dto.organizationId);
    if (!organization) throw new Error(ORGANIZATION_NOT_FOUND);

    const { members, errors } = parseMemberLines(dto.lines);
    const added: ParsedMemberLine[] = [];
    const alreadyMembers: ParsedMemberLine[] = [];
    const toOnboard: Member[] = [];

    for (const line of members) {
      const member = await this.memberRepository.upsertByEmail(line.name, line.email);
      const membership = await this.organizationMemberRepository.add(organization.id, member.id);
      if (!membership) {
        alreadyMembers.push(line);
        continue;
      }

      added.push(line);
      toOnboard.push(member);
    }

    runInBackground(this.sendOrganizationOnboardings(toOnboard), 'organization onboarding emails');

    return { added, alreadyMembers, errors };
  }

  /** Bulk adds can exceed Mailgun's send limit, so wait out the limit instead of dropping emails. */
  async sendOrganizationOnboardings(members: Member[]) {
    for (const member of members) {
      try {
        await this.sendOrganizationOnboarding(member, MAX_RATE_LIMIT_ATTEMPTS);
      } catch (error) {
        console.error(`Onboarding email failed for ${member.email}`, error);
      }
    }
  }

  private async sendOrganizationOnboarding(member: Member, attemptsLeft: number): Promise<void> {
    try {
      await this.memberNotificationRepository.sendOnboarding(
        member,
        MEMBER_EMAIL_TRIGGER.ORGANIZATION,
      );
    } catch (error) {
      if (!(error instanceof MailgunRateLimitError) || attemptsLeft <= 1) throw error;
      await sleep(Math.max(error.retryAt.diffNow().toMillis(), 0));
      await this.sendOrganizationOnboarding(member, attemptsLeft - 1);
    }
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
