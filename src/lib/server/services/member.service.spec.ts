import { MEMBER_SORT, SORT_DIRECTION } from '$lib/remotes/dtos/member.dto';
import type { DayPass, Member, MemberSubscription } from '$lib/server/db/schema';
import type { MemberRepositories } from '$lib/server/services/base.service';
import type { MemberAccessContext } from '$lib/server/utils/member_access';
import { DateTime } from 'luxon';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MEMBER_NOT_FOUND, MemberService, SUBSCRIPTION_NOT_FOUND } from './member.service';

const member: Member = {
  id: 'member-1',
  email: 'ada@example.com',
  name: 'Ada',
  phone: null,
  squareCustomerId: null,
  passToken: 'token',
  onboardingToken: 'onboarding-token',
  createdDate: DateTime.fromISO('2026-01-01'),
};

const subscription: MemberSubscription = {
  id: 'sub-1',
  memberId: member.id,
  planVariationId: 'plan',
  planName: 'Monthly',
  status: 'active',
  startDate: '2026-01-01',
  chargedThroughDate: '2026-11-01',
  canceledDate: null,
  accessEndedDate: null,
  refundedPaymentId: null,
  updatedDate: DateTime.fromISO('2026-01-01'),
};

const unusedPass: DayPass = {
  id: 'pass-1',
  memberId: member.id,
  squareOrderId: 'order',
  purchasedDate: DateTime.fromISO('2026-01-01'),
  usedDate: null,
};

function context(overrides: Partial<MemberAccessContext> = {}): MemberAccessContext {
  return {
    member,
    hasWaiver: true,
    subscriptions: [],
    organizations: [],
    dayPasses: [],
    ...overrides,
  };
}

describe('MemberService', () => {
  let service: MemberService;
  let repos: {
    memberRepository: Record<string, ReturnType<typeof vi.fn>>;
    memberSubscriptionRepository: Record<string, ReturnType<typeof vi.fn>>;
    dayPassRepository: Record<string, ReturnType<typeof vi.fn>>;
    visitRepository: Record<string, ReturnType<typeof vi.fn>>;
    memberEmailRepository: Record<string, ReturnType<typeof vi.fn>>;
    memberNotificationRepository: Record<string, ReturnType<typeof vi.fn>>;
  };
  let squareRepository: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    repos = {
      memberRepository: {
        getById: vi.fn(),
        getByIds: vi.fn(),
        getAccessContext: vi.fn(),
        getAccessContexts: vi.fn(),
        search: vi.fn(),
        getLatestWaiver: vi.fn(),
      },
      memberSubscriptionRepository: { getById: vi.fn(), listByMember: vi.fn(), endAccess: vi.fn() },
      dayPassRepository: { listByMember: vi.fn(), markUsed: vi.fn() },
      visitRepository: { create: vi.fn(), listByMember: vi.fn(), listRecent: vi.fn() },
      memberEmailRepository: { listByMember: vi.fn() },
      memberNotificationRepository: { sendOnboarding: vi.fn() },
    };
    squareRepository = {
      cancelSubscription: vi.fn(),
      refundLatestSubscriptionPayment: vi.fn(),
    };

    service = new MemberService(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      squareRepository as never,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      repos as unknown as Partial<MemberRepositories>,
    );
  });

  describe('listMembers', () => {
    it('resolves access and waiver status for each member on the page', async () => {
      const other = { ...member, id: 'member-2' };
      const pagination = { total: 2, page: 1, pageSize: 25, totalPages: 1 };
      const sentDate = DateTime.fromISO('2026-02-01');
      repos.memberRepository.search.mockResolvedValue({
        data: [
          { member, lastOnboardingSentDate: sentDate },
          { member: other, lastOnboardingSentDate: null },
        ],
        pagination,
      });
      repos.memberRepository.getAccessContexts.mockResolvedValue(
        new Map([
          [member.id, context({ subscriptions: [subscription] })],
          [other.id, context({ member: other, hasWaiver: false })],
        ]),
      );

      const result = await service.listMembers({
        query: '',
        access: [],
        waiver: [],
        onboarding: [],
        sort: MEMBER_SORT.NAME,
        direction: SORT_DIRECTION.ASC,
        page: 1,
        pageSize: 25,
      });

      expect(repos.memberRepository.getAccessContexts).toHaveBeenCalledWith([member.id, other.id]);
      expect(result).toEqual({
        data: [
          { member, basis: 'subscription', hasWaiver: true, lastOnboardingSentDate: sentDate },
          { member: other, basis: 'none', hasWaiver: false, lastOnboardingSentDate: null },
        ],
        pagination,
      });
    });
  });

  describe('getMemberDetail', () => {
    it('throws when the member does not exist', async () => {
      repos.memberRepository.getAccessContext.mockResolvedValue(undefined);

      await expect(service.getMemberDetail('missing')).rejects.toThrow(MEMBER_NOT_FOUND);
    });

    it('hides organizations the member was removed from', async () => {
      const organization = { id: 'org-1', name: 'Club', grantsAccess: true };
      const current = { membership: { removedDate: null }, organization };
      const removed = { membership: { removedDate: DateTime.now() }, organization };
      repos.memberRepository.getAccessContext.mockResolvedValue(
        context({ organizations: [current, removed] as never }),
      );
      repos.memberRepository.getLatestWaiver.mockResolvedValue({ id: 'waiver-1' });
      repos.memberSubscriptionRepository.listByMember.mockResolvedValue([]);
      repos.dayPassRepository.listByMember.mockResolvedValue([]);
      repos.memberEmailRepository.listByMember.mockResolvedValue([]);

      const detail = await service.getMemberDetail(member.id);

      expect(detail.organizations).toEqual([current]);
      expect(detail.waiver).toEqual({ id: 'waiver-1' });
      expect(detail.basis).toBe('organization');
    });
  });

  describe('cancelSubscription', () => {
    beforeEach(() => {
      repos.memberSubscriptionRepository.getById.mockResolvedValue(subscription);
    });

    it('cancels without ending access when not refunding', async () => {
      await service.cancelSubscription({
        memberId: member.id,
        subscriptionId: subscription.id,
        refund: false,
      });

      expect(squareRepository.cancelSubscription).toHaveBeenCalledWith(subscription.id);
      expect(squareRepository.refundLatestSubscriptionPayment).not.toHaveBeenCalled();
      expect(repos.memberSubscriptionRepository.endAccess).not.toHaveBeenCalled();
    });

    it('refunds the latest payment and ends access when refunding', async () => {
      squareRepository.refundLatestSubscriptionPayment.mockResolvedValue('payment-1');

      await service.cancelSubscription({
        memberId: member.id,
        subscriptionId: subscription.id,
        refund: true,
      });

      expect(squareRepository.cancelSubscription).toHaveBeenCalledWith(subscription.id);
      expect(squareRepository.refundLatestSubscriptionPayment).toHaveBeenCalledWith(
        subscription.id,
      );
      expect(repos.memberSubscriptionRepository.endAccess).toHaveBeenCalledWith(
        subscription.id,
        'payment-1',
      );
    });

    it('rejects a subscription that belongs to another member', async () => {
      await expect(
        service.cancelSubscription({
          memberId: 'someone-else',
          subscriptionId: subscription.id,
          refund: true,
        }),
      ).rejects.toThrow(SUBSCRIPTION_NOT_FOUND);
      expect(squareRepository.cancelSubscription).not.toHaveBeenCalled();
    });

    it('leaves the subscription running when the refund fails', async () => {
      squareRepository.refundLatestSubscriptionPayment.mockRejectedValue(new Error('no invoice'));

      await expect(
        service.cancelSubscription({
          memberId: member.id,
          subscriptionId: subscription.id,
          refund: true,
        }),
      ).rejects.toThrow('no invoice');
      expect(squareRepository.cancelSubscription).not.toHaveBeenCalled();
      expect(repos.memberSubscriptionRepository.endAccess).not.toHaveBeenCalled();
    });

    it('refunds a subscription already canceled at period end without canceling again', async () => {
      repos.memberSubscriptionRepository.getById.mockResolvedValue({
        ...subscription,
        canceledDate: '2026-11-01',
      });
      squareRepository.refundLatestSubscriptionPayment.mockResolvedValue('payment-1');

      await service.cancelSubscription({
        memberId: member.id,
        subscriptionId: subscription.id,
        refund: true,
      });

      expect(repos.memberSubscriptionRepository.endAccess).toHaveBeenCalledWith(
        subscription.id,
        'payment-1',
      );
      expect(squareRepository.cancelSubscription).not.toHaveBeenCalled();
    });
  });

  describe('resendOnboarding', () => {
    it('sends onboarding with the manual trigger', async () => {
      repos.memberRepository.getById.mockResolvedValue(member);

      await service.resendOnboarding(member.id);

      expect(repos.memberNotificationRepository.sendOnboarding).toHaveBeenCalledWith(
        member,
        'manual',
      );
    });

    it('throws when the member does not exist', async () => {
      repos.memberRepository.getById.mockResolvedValue(undefined);

      await expect(service.resendOnboarding('missing')).rejects.toThrow(MEMBER_NOT_FOUND);
    });
  });

  describe('sendOnboardings', () => {
    it('keeps sending after one email fails and reports who failed', async () => {
      const other = { ...member, id: 'member-2', name: 'Grace' };
      repos.memberRepository.getByIds.mockResolvedValue([member, other]);
      repos.memberNotificationRepository.sendOnboarding
        .mockRejectedValueOnce(new Error('mailgun down'))
        .mockResolvedValueOnce(undefined);

      const result = await service.sendOnboardings([member.id, other.id]);

      expect(repos.memberNotificationRepository.sendOnboarding).toHaveBeenCalledWith(
        other,
        'manual',
      );
      expect(result).toEqual({ sent: ['Grace'], failed: ['Ada'] });
    });
  });

  describe('checkIn', () => {
    it('admits a member without access and records basis none', async () => {
      repos.memberRepository.getAccessContext.mockResolvedValue(context({ hasWaiver: false }));

      await service.checkIn(member.id);

      expect(repos.visitRepository.create).toHaveBeenCalledWith({
        memberId: member.id,
        source: 'staff',
        accessBasis: 'none',
        outcome: 'admitted',
      });
      expect(repos.dayPassRepository.markUsed).not.toHaveBeenCalled();
    });

    it('uses up an unused day pass when that is the access basis', async () => {
      repos.memberRepository.getAccessContext.mockResolvedValue(
        context({ dayPasses: [unusedPass] }),
      );

      await service.checkIn(member.id);

      expect(repos.dayPassRepository.markUsed).toHaveBeenCalledWith(
        unusedPass.id,
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      );
      expect(repos.visitRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ accessBasis: 'day_pass', outcome: 'admitted' }),
      );
    });

    it('throws when the member does not exist', async () => {
      repos.memberRepository.getAccessContext.mockResolvedValue(undefined);

      await expect(service.checkIn('missing')).rejects.toThrow(MEMBER_NOT_FOUND);
      expect(repos.visitRepository.create).not.toHaveBeenCalled();
    });
  });
});
