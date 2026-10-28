import { factory } from '$test/factory';
import { memberAccessContext, organizationAccess } from '$test/factory/member_access';
import { newTestService, type ServiceMocks } from '$test/utils';
import { DateTime } from 'luxon';
import { beforeEach, describe, expect, it } from 'vitest';
import { OnboardingService, PASS_EMAIL_COOLDOWN } from './onboarding.service';

const MEMBER = factory.member({
  email: 'sam@example.com',
  name: 'Sam Smith',
  passToken: 'token-abc',
  onboardingToken: 'onboarding-abc',
});

const ACTIVE_CONTEXT = memberAccessContext({
  member: MEMBER,
  dayPasses: [factory.dayPass({ memberId: MEMBER.id })],
});

const SIGNATURE = new File(['sig'], 'signature.jpg');

describe(OnboardingService.name, () => {
  let sut: OnboardingService;
  let mocks: ServiceMocks;

  beforeEach(() => {
    ({ sut, mocks } = newTestService(OnboardingService));

    mocks.memberRepository.getByOnboardingToken.mockResolvedValue(MEMBER);
    mocks.memberRepository.getAccessContext.mockResolvedValue(
      memberAccessContext({ member: MEMBER, hasWaiver: false }),
    );
    mocks.memberRepository.getAccessContextByEmail.mockResolvedValue(ACTIVE_CONTEXT);
    mocks.waiverRepository.submit.mockResolvedValue(factory.waiver({ memberId: MEMBER.id }));
    mocks.memberEmailRepository.listByMember.mockResolvedValue([]);
    mocks.memberNotificationRepository.sendOnboarding.mockResolvedValue(undefined);
  });

  describe('getOnboarding', () => {
    it('returns undefined for an unknown token', async () => {
      mocks.memberRepository.getByOnboardingToken.mockResolvedValue(undefined as never);
      expect(await sut.getOnboarding('nope')).toBeUndefined();
    });

    it('looks members up by onboarding token so a scanned QR cannot open it', async () => {
      await sut.getOnboarding('onboarding-abc');

      expect(mocks.memberRepository.getByOnboardingToken).toHaveBeenCalledWith('onboarding-abc');
    });

    it('reports waiver status', async () => {
      expect(await sut.getOnboarding('onboarding-abc')).toEqual({
        name: 'Sam Smith',
        email: 'sam@example.com',
        passToken: 'token-abc',
        hasWaiver: false,
      });
      expect(mocks.memberRepository.getAccessContext).toHaveBeenCalledWith(MEMBER.id);
    });

    it('reports a signed waiver', async () => {
      mocks.memberRepository.getAccessContext.mockResolvedValue(
        memberAccessContext({ member: MEMBER, hasWaiver: true }),
      );

      expect((await sut.getOnboarding('onboarding-abc'))?.hasWaiver).toBe(true);
    });
  });

  describe('submitWaiver', () => {
    const dto = { token: 'onboarding-abc', name: 'Sam S', signature: SIGNATURE, isAdult: true };

    it("signs with the member's email regardless of the form", async () => {
      expect(await sut.submitWaiver(dto)).toBe(true);
      expect(mocks.waiverRepository.submit).toHaveBeenCalledWith(
        { name: 'Sam S', email: 'sam@example.com', signature: SIGNATURE, isAdult: true },
        MEMBER.id,
        'web',
      );
    });

    it('skips members who already signed', async () => {
      mocks.memberRepository.getAccessContext.mockResolvedValue(
        memberAccessContext({ member: MEMBER, hasWaiver: true }),
      );
      expect(await sut.submitWaiver(dto)).toBe(true);
      expect(mocks.waiverRepository.submit).not.toHaveBeenCalled();
    });

    it('rejects unknown tokens', async () => {
      mocks.memberRepository.getByOnboardingToken.mockResolvedValue(undefined as never);
      expect(await sut.submitWaiver(dto)).toBe(false);
      expect(mocks.waiverRepository.submit).not.toHaveBeenCalled();
    });
  });

  describe('requestOnboardingEmail', () => {
    it('sends onboarding to a member with access', async () => {
      await sut.requestOnboardingEmail('sam@example.com');

      expect(mocks.memberNotificationRepository.sendOnboarding).toHaveBeenCalledWith(
        MEMBER,
        'self_service',
      );
    });

    it('sends nothing for an unknown email', async () => {
      mocks.memberRepository.getAccessContextByEmail.mockResolvedValue(undefined);

      await sut.requestOnboardingEmail('nobody@example.com');

      expect(mocks.memberNotificationRepository.sendOnboarding).not.toHaveBeenCalled();
    });

    it('sends nothing to a member without access', async () => {
      mocks.memberRepository.getAccessContextByEmail.mockResolvedValue({
        ...ACTIVE_CONTEXT,
        dayPasses: [],
      });

      await sut.requestOnboardingEmail('sam@example.com');

      expect(mocks.memberNotificationRepository.sendOnboarding).not.toHaveBeenCalled();
    });

    it('sends onboarding to an organization member whose organization grants no access', async () => {
      mocks.memberRepository.getAccessContextByEmail.mockResolvedValue({
        ...ACTIVE_CONTEXT,
        dayPasses: [],
        organizations: [organizationAccess({ grantsAccess: false }, { memberId: MEMBER.id })],
      });

      await sut.requestOnboardingEmail('sam@example.com');

      expect(mocks.memberNotificationRepository.sendOnboarding).toHaveBeenCalledWith(
        MEMBER,
        'self_service',
      );
    });

    it('sends nothing when an onboarding email went out within the cooldown', async () => {
      mocks.memberEmailRepository.listByMember.mockResolvedValue([
        factory.memberEmail({
          memberId: MEMBER.id,
          sentDate: DateTime.now().minus({ minutes: 1 }),
        }),
      ]);

      await sut.requestOnboardingEmail('sam@example.com');

      expect(mocks.memberNotificationRepository.sendOnboarding).not.toHaveBeenCalled();
    });

    it('sends again once the cooldown has passed', async () => {
      mocks.memberEmailRepository.listByMember.mockResolvedValue([
        factory.memberEmail({
          memberId: MEMBER.id,
          sentDate: DateTime.now().minus(PASS_EMAIL_COOLDOWN).minus({ minutes: 1 }),
        }),
      ]);

      await sut.requestOnboardingEmail('sam@example.com');

      expect(mocks.memberNotificationRepository.sendOnboarding).toHaveBeenCalled();
    });
  });
});
