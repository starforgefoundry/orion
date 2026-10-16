import type {
  CancelMemberSubscriptionDto,
  MemberSearchFilter,
  MemberVisitsDto,
  RecentVisitsDto,
} from '$lib/remotes/dtos/member.dto';
import { ACCESS_BASIS, MEMBER_EMAIL_TRIGGER, VISIT_OUTCOME, VISIT_SOURCE } from '$lib/member_enums';
import { BaseService } from '$lib/server/services/base.service';
import { resolveAccess, spaceDate } from '$lib/server/utils/member_access';
import { DateTime } from 'luxon';

export const MEMBER_NOT_FOUND = 'Member not found';
export const SUBSCRIPTION_NOT_FOUND = 'Subscription not found';

export class MemberService extends BaseService {
  async listMembers(filter: MemberSearchFilter) {
    const now = DateTime.now();
    const { data, pagination } = await this.memberRepository.search(filter, now);
    const contexts = await this.memberRepository.getAccessContexts(
      data.map(({ member }) => member.id),
    );

    const rows = data.map(({ member, lastOnboardingSentDate }) => {
      const context = contexts.get(member.id);
      return {
        member,
        basis: context ? resolveAccess(context, now).basis : ACCESS_BASIS.NONE,
        hasWaiver: context?.hasWaiver ?? false,
        lastOnboardingSentDate,
      };
    });
    return { data: rows, pagination };
  }

  async getMemberDetail(memberId: string) {
    const context = await this.memberRepository.getAccessContext(memberId);
    if (!context) throw new Error(MEMBER_NOT_FOUND);

    const [waiver, subscriptions, dayPasses, emails] = await Promise.all([
      this.memberRepository.getLatestWaiver(memberId),
      this.memberSubscriptionRepository.listByMember(memberId),
      this.dayPassRepository.listByMember(memberId),
      this.memberEmailRepository.listByMember(memberId),
    ]);

    return {
      member: context.member,
      basis: resolveAccess(context, DateTime.now()).basis,
      waiver: waiver ?? null,
      subscriptions,
      dayPasses,
      organizations: context.organizations.filter(({ membership }) => !membership.removedDate),
      emails,
    };
  }

  async listMemberVisits(dto: MemberVisitsDto) {
    return await this.visitRepository.listByMember(dto.memberId, dto.page, dto.pageSize);
  }

  async listRecentVisits(dto: RecentVisitsDto) {
    return await this.visitRepository.listRecent(dto.page, dto.pageSize);
  }

  /** A refund also ends access right away; otherwise access lasts through the paid period. */
  async cancelSubscription(dto: CancelMemberSubscriptionDto) {
    const subscription = await this.memberSubscriptionRepository.getById(dto.subscriptionId);
    if (!subscription || subscription.memberId !== dto.memberId) {
      throw new Error(SUBSCRIPTION_NOT_FOUND);
    }

    if (dto.refund) {
      const paymentId = await this.squareRepository.refundLatestSubscriptionPayment(
        subscription.id,
      );
      await this.memberSubscriptionRepository.endAccess(subscription.id, paymentId);
    }
    if (!subscription.canceledDate) {
      await this.squareRepository.cancelSubscription(subscription.id);
    }
  }

  async resendOnboarding(memberId: string) {
    const member = await this.memberRepository.getById(memberId);
    if (!member) throw new Error(MEMBER_NOT_FOUND);
    await this.memberNotificationRepository.sendOnboarding(member, MEMBER_EMAIL_TRIGGER.MANUAL);
  }

  /** One failed email does not stop the rest; failures come back by member name. */
  async sendOnboardings(memberIds: string[]) {
    const members = await this.memberRepository.getByIds(memberIds);
    const results = await Promise.allSettled(
      members.map((member) =>
        this.memberNotificationRepository.sendOnboarding(member, MEMBER_EMAIL_TRIGGER.MANUAL),
      ),
    );
    const failed = members.filter((_, index) => results[index].status === 'rejected');
    return {
      sent: members.filter((member) => !failed.includes(member)).map((member) => member.name),
      failed: failed.map((member) => member.name),
    };
  }

  /** Staff override: always admits, recording whatever access the member has. */
  async checkIn(memberId: string) {
    const context = await this.memberRepository.getAccessContext(memberId);
    if (!context) throw new Error(MEMBER_NOT_FOUND);

    const now = DateTime.now();
    const access = resolveAccess(context, now);
    if (access.dayPassToUse) {
      await this.dayPassRepository.markUsed(access.dayPassToUse.id, spaceDate(now));
    }

    return await this.visitRepository.create({
      memberId,
      source: VISIT_SOURCE.STAFF,
      accessBasis: access.basis,
      outcome: VISIT_OUTCOME.ADMITTED,
    });
  }
}

export const memberService = new MemberService();
