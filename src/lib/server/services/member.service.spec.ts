import { MEMBER_SORT, SORT_DIRECTION } from '$lib/remotes/dtos/member.dto';
import { factory } from '$test/factory';
import { memberAccessContext, organizationAccess } from '$test/factory/member_access';
import { newTestService, type ServiceMocks } from '$test/utils';
import { DateTime } from 'luxon';
import { beforeEach, describe, expect, it } from 'vitest';
import { MEMBER_NOT_FOUND, MemberService, SUBSCRIPTION_NOT_FOUND } from './member.service';

const member = factory.member({ name: 'Ada' });
const subscription = factory.memberSubscription({
  memberId: member.id,
  chargedThroughDate: '2026-11-01',
});
const unusedPass = factory.dayPass({ memberId: member.id });

describe(MemberService.name, () => {
  let sut: MemberService;
  let mocks: ServiceMocks;

  beforeEach(() => {
    ({ sut, mocks } = newTestService(MemberService));
  });

  describe('listMembers', () => {
    it('resolves access and waiver status for each member on the page', async () => {
      const other = factory.member();
      const pagination = { total: 2, page: 1, pageSize: 25, totalPages: 1 };
      const sentDate = DateTime.fromISO('2026-02-01');
      mocks.memberRepository.search.mockResolvedValue({
        data: [
          { member, lastOnboardingSentDate: sentDate },
          { member: other, lastOnboardingSentDate: null },
        ],
        pagination,
      });
      mocks.memberRepository.getAccessContexts.mockResolvedValue(
        new Map([
          [member.id, memberAccessContext({ member, subscriptions: [subscription] })],
          [other.id, memberAccessContext({ member: other, hasWaiver: false })],
        ]),
      );

      const result = await sut.listMembers({
        query: '',
        access: [],
        waiver: [],
        onboarding: [],
        sort: MEMBER_SORT.NAME,
        direction: SORT_DIRECTION.ASC,
        page: 1,
        pageSize: 25,
      });

      expect(mocks.memberRepository.getAccessContexts).toHaveBeenCalledWith([member.id, other.id]);
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
      mocks.memberRepository.getAccessContext.mockResolvedValue(undefined);

      await expect(sut.getMemberDetail('missing')).rejects.toThrow(MEMBER_NOT_FOUND);
    });

    it('hides organizations the member was removed from', async () => {
      const current = organizationAccess({ grantsAccess: true });
      const removed = organizationAccess({}, { removedDate: DateTime.now() });
      const waiver = factory.waiver({ memberId: member.id });
      mocks.memberRepository.getAccessContext.mockResolvedValue(
        memberAccessContext({ member, organizations: [current, removed] }),
      );
      mocks.memberRepository.getLatestWaiver.mockResolvedValue(waiver);
      mocks.memberSubscriptionRepository.listByMember.mockResolvedValue([]);
      mocks.dayPassRepository.listByMember.mockResolvedValue([]);
      mocks.memberEmailRepository.listByMember.mockResolvedValue([]);

      const detail = await sut.getMemberDetail(member.id);

      expect(detail.organizations).toEqual([current]);
      expect(detail.waiver).toEqual(waiver);
      expect(detail.basis).toBe('organization');
    });
  });

  describe('cancelSubscription', () => {
    beforeEach(() => {
      mocks.memberSubscriptionRepository.getById.mockResolvedValue(subscription);
      mocks.memberSubscriptionRepository.endAccess.mockResolvedValue(undefined);
      mocks.squareRepository.cancelSubscription.mockResolvedValue(undefined);
    });

    it('cancels without ending access when not refunding', async () => {
      await sut.cancelSubscription({
        memberId: member.id,
        subscriptionId: subscription.id,
        refund: false,
      });

      expect(mocks.squareRepository.cancelSubscription).toHaveBeenCalledWith(subscription.id);
      expect(mocks.squareRepository.refundLatestSubscriptionPayment).not.toHaveBeenCalled();
      expect(mocks.memberSubscriptionRepository.endAccess).not.toHaveBeenCalled();
    });

    it('refunds the latest payment and ends access when refunding', async () => {
      mocks.squareRepository.refundLatestSubscriptionPayment.mockResolvedValue('payment-1');

      await sut.cancelSubscription({
        memberId: member.id,
        subscriptionId: subscription.id,
        refund: true,
      });

      expect(mocks.squareRepository.cancelSubscription).toHaveBeenCalledWith(subscription.id);
      expect(mocks.squareRepository.refundLatestSubscriptionPayment).toHaveBeenCalledWith(
        subscription.id,
      );
      expect(mocks.memberSubscriptionRepository.endAccess).toHaveBeenCalledWith(
        subscription.id,
        'payment-1',
      );
    });

    it('rejects a subscription that belongs to another member', async () => {
      await expect(
        sut.cancelSubscription({
          memberId: 'someone-else',
          subscriptionId: subscription.id,
          refund: true,
        }),
      ).rejects.toThrow(SUBSCRIPTION_NOT_FOUND);
      expect(mocks.squareRepository.cancelSubscription).not.toHaveBeenCalled();
    });

    it('leaves the subscription running when the refund fails', async () => {
      mocks.squareRepository.refundLatestSubscriptionPayment.mockRejectedValue(
        new Error('no invoice'),
      );

      await expect(
        sut.cancelSubscription({
          memberId: member.id,
          subscriptionId: subscription.id,
          refund: true,
        }),
      ).rejects.toThrow('no invoice');
      expect(mocks.squareRepository.cancelSubscription).not.toHaveBeenCalled();
      expect(mocks.memberSubscriptionRepository.endAccess).not.toHaveBeenCalled();
    });

    it('refunds a subscription already canceled at period end without canceling again', async () => {
      mocks.memberSubscriptionRepository.getById.mockResolvedValue({
        ...subscription,
        canceledDate: '2026-11-01',
      });
      mocks.squareRepository.refundLatestSubscriptionPayment.mockResolvedValue('payment-1');

      await sut.cancelSubscription({
        memberId: member.id,
        subscriptionId: subscription.id,
        refund: true,
      });

      expect(mocks.memberSubscriptionRepository.endAccess).toHaveBeenCalledWith(
        subscription.id,
        'payment-1',
      );
      expect(mocks.squareRepository.cancelSubscription).not.toHaveBeenCalled();
    });
  });

  describe('resendOnboarding', () => {
    it('sends onboarding with the manual trigger', async () => {
      mocks.memberRepository.getById.mockResolvedValue(member);
      mocks.memberNotificationRepository.sendOnboarding.mockResolvedValue(undefined);

      await sut.resendOnboarding(member.id);

      expect(mocks.memberNotificationRepository.sendOnboarding).toHaveBeenCalledWith(
        member,
        'manual',
      );
    });

    it('throws when the member does not exist', async () => {
      mocks.memberRepository.getById.mockResolvedValue(undefined as never);

      await expect(sut.resendOnboarding('missing')).rejects.toThrow(MEMBER_NOT_FOUND);
    });
  });

  describe('sendOnboardings', () => {
    it('keeps sending after one email fails and reports who failed', async () => {
      const other = factory.member({ name: 'Grace' });
      mocks.memberRepository.getByIds.mockResolvedValue([member, other]);
      mocks.memberNotificationRepository.sendOnboarding
        .mockRejectedValueOnce(new Error('mailgun down'))
        .mockResolvedValueOnce(undefined);

      const result = await sut.sendOnboardings([member.id, other.id]);

      expect(mocks.memberNotificationRepository.sendOnboarding).toHaveBeenCalledWith(
        other,
        'manual',
      );
      expect(result).toEqual({ sent: ['Grace'], failed: ['Ada'] });
    });
  });

  describe('checkIn', () => {
    beforeEach(() => {
      mocks.visitRepository.create.mockResolvedValue(factory.visit({ memberId: member.id }));
    });

    it('admits a member without access and records basis none', async () => {
      mocks.memberRepository.getAccessContext.mockResolvedValue(
        memberAccessContext({ member, hasWaiver: false }),
      );

      await sut.checkIn(member.id);

      expect(mocks.visitRepository.create).toHaveBeenCalledWith({
        memberId: member.id,
        source: 'staff',
        accessBasis: 'none',
        outcome: 'admitted',
      });
      expect(mocks.dayPassRepository.markUsed).not.toHaveBeenCalled();
    });

    it('uses up an unused day pass when that is the access basis', async () => {
      mocks.memberRepository.getAccessContext.mockResolvedValue(
        memberAccessContext({ member, dayPasses: [unusedPass] }),
      );
      mocks.dayPassRepository.markUsed.mockResolvedValue(undefined);

      await sut.checkIn(member.id);

      expect(mocks.dayPassRepository.markUsed).toHaveBeenCalledWith(
        unusedPass.id,
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      );
      expect(mocks.visitRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ accessBasis: 'day_pass', outcome: 'admitted' }),
      );
    });

    it('throws when the member does not exist', async () => {
      mocks.memberRepository.getAccessContext.mockResolvedValue(undefined);

      await expect(sut.checkIn('missing')).rejects.toThrow(MEMBER_NOT_FOUND);
      expect(mocks.visitRepository.create).not.toHaveBeenCalled();
    });
  });
});
