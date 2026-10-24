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
import { payUrl } from '$lib/server/utils/payment_links';
import {
  buildBill,
  CENTS_PER_DOLLAR,
  PAYMENT_STATUS,
  PAYMENT_TYPE,
  type PaymentStatus,
} from '$lib/utils/billing';
import { env as publicEnv } from '$env/dynamic/public';
import { DateTime } from 'luxon';

export const ORGANIZATION_NOT_FOUND = 'Organization not found';
const MAX_RATE_LIMIT_ATTEMPTS = 5;
const BALANCE_LINE_ITEM_NAME = 'Organization Balance Payment';
const BALANCE_DESCRIPTION = "your organization's outstanding balance";
const OWED_STATUSES = new Set<PaymentStatus>([PAYMENT_STATUS.PENDING, PAYMENT_STATUS.PAID]);

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

    for (const row of allPayments) {
      if (row.type === PAYMENT_TYPE.BALANCE) {
        totalOwed -= row.total;
      } else if (OWED_STATUSES.has(row.status)) {
        totalOwed += row.total;
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

    const id = crypto.randomUUID();
    const payment = await this.paymentRepository.save(
      {
        type: PAYMENT_TYPE.BALANCE,
        status: PAYMENT_STATUS.PENDING,
        customer: { name: organization.name, email: organization.email },
        bill: buildBill([
          { name: BALANCE_LINE_ITEM_NAME, quantity: 1, unitAmount: outstandingBalance },
        ]),
        organizationId: organization.id,
        paymentUrl: payUrl({ id }),
      },
      id,
    );

    await this.mailgunRepository.sendTemplate(
      organization.email,
      `Starforge Foundry <${publicEnv.PUBLIC_PRINT_REQUEST_EMAIL}>`,
      publicEnv.PUBLIC_PRINT_REQUEST_EMAIL,
      'Starforge Organization Balance Due',
      'payment_request',
      {
        customerName: organization.name,
        description: BALANCE_DESCRIPTION,
        total: (payment.total / CENTS_PER_DOLLAR).toFixed(2),
        paymentUrl: payment.paymentUrl ?? payUrl(payment),
      },
    );

    return payment;
  }

  async createCharge(dto: CreateOrgChargeDto) {
    const organization = await this.organizationRepository.getById(dto.organizationId);
    if (!organization) throw new Error(ORGANIZATION_NOT_FOUND);
    return await this.organizationRepository.createCharge(dto, organization);
  }
}

export const organizationService = new OrganizationService();
