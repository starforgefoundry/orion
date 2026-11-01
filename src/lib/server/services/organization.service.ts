import type {
  AddOrganizationMembersDto,
  ChargeOrganizationBalanceDto,
  CreateOrganizationDto,
  UpdateOrganizationDto,
} from '$lib/remotes/dtos/organization.dto';
import type { CreateOrgChargeDto } from '$lib/remotes/dtos/organization_charges.dto';
import { NotFoundError, UserError } from '$lib/errors';
import { MEMBER_EMAIL_TRIGGER } from '$lib/member_enums';
import type { Member, Payment } from '$lib/server/db/schema';
import { MailgunRateLimitError } from '$lib/server/gateways/mailgun.gateway';
import { BaseService } from '$lib/server/services/base.service';
import { runInBackground } from '$lib/server/utils/background';
import { accessEndOfDay } from '$lib/server/utils/member_access';
import { parseMemberLines, type ParsedMemberLine } from '$lib/server/utils/member_lines';
import { SENDERS } from '$lib/server/utils/email_templates/senders';
import { paymentLink, payUrl } from '$lib/server/utils/payment_links';
import {
  buildBill,
  centsToDollars,
  PAYMENT_STATUS,
  PAYMENT_TYPE,
  type PaymentStatus,
} from '$lib/utils/billing';

export const ORGANIZATION_NOT_FOUND = 'Organization not found';
export const ORGANIZATION_CHARGE_TYPE = { PRINT: 'print', CHARGE: 'charge' } as const;
/** Staff charges are billed as soon as they are added. */
const CHARGED_STATUS = 'charged';
const MAX_RATE_LIMIT_ATTEMPTS = 5;
const BALANCE_LINE_ITEM_NAME = 'Organization Balance Payment';
const OWED_STATUSES = new Set<PaymentStatus>([
  PAYMENT_STATUS.PENDING,
  PAYMENT_STATUS.PROCESSING,
  PAYMENT_STATUS.PAID,
]);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Balance payments pay down what the organization owes. */
export function outstandingBalance(payments: Pick<Payment, 'type' | 'status' | 'total'>[]) {
  return payments.reduce((owed, payment) => {
    if (payment.type === PAYMENT_TYPE.BALANCE) return owed - payment.total;
    return OWED_STATUSES.has(payment.status) ? owed + payment.total : owed;
  }, 0);
}

export class OrganizationService extends BaseService {
  async getOrganizations() {
    return await this.organizationRepository.getAll();
  }

  async getOrganizationDetail(id: string) {
    const organization = await this.organizationRepository.getById(id);
    if (!organization) {
      throw new NotFoundError(ORGANIZATION_NOT_FOUND);
    }

    const [outstandingBalance, printRequests, organizationCharges, balancePayments] =
      await Promise.all([
        this.getOutstandingBalance(id),
        this.organizationRepository.getPrintRequests(id),
        this.organizationRepository.getCharges(id),
        this.organizationRepository.getBalancePayments(id),
      ]);

    const printCharges = printRequests.map((req) => ({
      id: req.id,
      description: `Print Request - ${req.projectName}`,
      date: req.submissionDate,
      amount: req.payment?.total ?? 0,
      status: req.status,
      type: ORGANIZATION_CHARGE_TYPE.PRINT,
    }));
    const orgCharges = organizationCharges.map((charge) => ({
      id: charge.id,
      description: charge.description,
      date: charge.creationDate,
      amount: charge.payment.total,
      status: CHARGED_STATUS,
      type: ORGANIZATION_CHARGE_TYPE.CHARGE,
    }));

    const allCharges = [...printCharges, ...orgCharges]
      .sort((a, b) => b.date.toMillis() - a.date.toMillis())
      .map((charge) => ({ ...charge, date: charge.date.toISO()! }));

    return {
      id: organization.id,
      name: organization.name,
      email: organization.email,
      grantsAccess: organization.grantsAccess,
      accessEndDate: organization.accessEndDate,
      outstandingBalance,
      charges: allCharges,
      balancePayments: balancePayments.map((payment) => ({
        ...payment,
        paymentUrl: paymentLink(payment),
      })),
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
    if (!organization) throw new NotFoundError(ORGANIZATION_NOT_FOUND);

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
  private async sendOrganizationOnboardings(members: Member[]) {
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
      await this.memberNotificationGateway.sendOnboarding(
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

  private async getOutstandingBalance(organizationId: string) {
    return outstandingBalance(await this.organizationRepository.getPayments(organizationId));
  }

  async chargeBalance(dto: ChargeOrganizationBalanceDto) {
    const organization = await this.organizationRepository.getById(dto.organizationId);
    if (!organization) {
      throw new NotFoundError(ORGANIZATION_NOT_FOUND);
    }

    const outstandingBalance = await this.getOutstandingBalance(dto.organizationId);

    if (outstandingBalance <= 0) {
      throw new UserError('No outstanding balance to charge');
    }

    const payment = await this.paymentRepository.save({
      type: PAYMENT_TYPE.BALANCE,
      status: PAYMENT_STATUS.PENDING,
      customer: { name: organization.name, email: organization.email },
      bill: buildBill([
        { name: BALANCE_LINE_ITEM_NAME, quantity: 1, unitAmount: outstandingBalance },
      ]),
      organizationId: organization.id,
    });

    await this.mailgunGateway.sendTemplate(
      organization.email,
      SENDERS.foundry,
      'organization_balance',
      {
        organizationName: organization.name,
        total: centsToDollars(payment.total),
        paymentUrl: payUrl(payment),
      },
    );

    return payment;
  }

  async createCharge(dto: CreateOrgChargeDto) {
    const organization = await this.organizationRepository.getById(dto.organizationId);
    if (!organization) throw new NotFoundError(ORGANIZATION_NOT_FOUND);
    return await this.organizationRepository.createCharge(organization.id, dto.description, {
      type: PAYMENT_TYPE.ORG_CHARGE,
      status: PAYMENT_STATUS.PAID,
      customer: { name: organization.name, email: organization.email },
      bill: buildBill([{ name: dto.description, quantity: 1, unitAmount: dto.amount }]),
    });
  }
}

export const organizationService = new OrganizationService();
