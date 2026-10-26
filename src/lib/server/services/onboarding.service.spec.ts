import {
  appleWalletConfig,
  buildApplePass,
  type AppleWalletConfig,
} from '$lib/server/utils/apple_wallet';
import { googleWalletConfig, type GoogleWalletConfig } from '$lib/server/utils/google_wallet';
import { factory } from '$test/factory';
import { memberAccessContext, organizationAccess } from '$test/factory/member_access';
import { newTestService, type ServiceMocks } from '$test/utils';
import { DateTime } from 'luxon';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OnboardingService, PASS_EMAIL_COOLDOWN } from './onboarding.service';

vi.mock('$lib/server/utils/google_wallet', () => ({
  googleWalletConfig: vi.fn(),
  googleWalletSaveUrl: vi.fn(() => 'https://pay.google.com/gp/v/save/jwt'),
}));

vi.mock('$lib/server/utils/apple_wallet', () => ({
  appleWalletConfig: vi.fn(),
  buildApplePass: vi.fn(() => Buffer.from('pkpass')),
}));

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

const WALLET_CONFIG = { issuerId: 'issuer' } as GoogleWalletConfig;
const APPLE_CONFIG = { passTypeId: 'pass.test' } as AppleWalletConfig;
const SIGNATURE = new File(['sig'], 'signature.jpg');

describe(OnboardingService.name, () => {
  let sut: OnboardingService;
  let mocks: ServiceMocks;

  beforeEach(() => {
    ({ sut, mocks } = newTestService(OnboardingService));

    mocks.memberRepository.getByPassToken.mockResolvedValue(MEMBER);
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
      expect(mocks.memberRepository.getByPassToken).not.toHaveBeenCalled();
    });

    it('reports waiver status and hides wallets that are not configured', async () => {
      expect(await sut.getOnboarding('onboarding-abc')).toEqual({
        name: 'Sam Smith',
        email: 'sam@example.com',
        passToken: 'token-abc',
        passUrl: 'https://orion.example.com/pass/token-abc',
        hasWaiver: false,
        wallets: [],
      });
      expect(mocks.memberRepository.getAccessContext).toHaveBeenCalledWith(MEMBER.id);
    });

    it('offers Google Wallet when it is configured', async () => {
      vi.mocked(googleWalletConfig).mockReturnValue(WALLET_CONFIG);
      mocks.memberRepository.getAccessContext.mockResolvedValue(
        memberAccessContext({ member: MEMBER, hasWaiver: true }),
      );

      const onboarding = await sut.getOnboarding('token-abc');

      expect(onboarding?.hasWaiver).toBe(true);
      expect(onboarding?.wallets).toEqual(['google']);
    });

    it('offers both wallets when both are configured', async () => {
      vi.mocked(googleWalletConfig).mockReturnValue(WALLET_CONFIG);
      vi.mocked(appleWalletConfig).mockReturnValue(APPLE_CONFIG);

      expect((await sut.getOnboarding('token-abc'))?.wallets).toEqual(['apple', 'google']);
    });
  });

  describe('getApplePass', () => {
    it('returns undefined when Apple Wallet is not configured', async () => {
      expect(await sut.getApplePass('token-abc')).toBeUndefined();
      expect(buildApplePass).not.toHaveBeenCalled();
    });

    it('returns undefined for an unknown token', async () => {
      vi.mocked(appleWalletConfig).mockReturnValue(APPLE_CONFIG);
      mocks.memberRepository.getByPassToken.mockResolvedValue(undefined as never);
      expect(await sut.getApplePass('nope')).toBeUndefined();
    });

    it("builds the member's pass", async () => {
      vi.mocked(appleWalletConfig).mockReturnValue(APPLE_CONFIG);
      expect((await sut.getApplePass('token-abc'))?.toString()).toBe('pkpass');
      expect(buildApplePass).toHaveBeenCalledWith(MEMBER, APPLE_CONFIG);
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

  describe('getGoogleWalletUrl', () => {
    it('returns undefined when Google Wallet is not configured', async () => {
      expect(await sut.getGoogleWalletUrl('token-abc')).toBeUndefined();
      expect(mocks.memberRepository.getByPassToken).not.toHaveBeenCalled();
    });

    it('returns a save link for the member', async () => {
      vi.mocked(googleWalletConfig).mockReturnValue(WALLET_CONFIG);
      expect(await sut.getGoogleWalletUrl('token-abc')).toBe(
        'https://pay.google.com/gp/v/save/jwt',
      );
    });
  });

  describe('getMemberPass', () => {
    it('returns the name, QR value and configured wallets', async () => {
      expect(await sut.getMemberPass('token-abc')).toEqual({
        name: 'Sam Smith',
        passUrl: 'https://orion.example.com/pass/token-abc',
        wallets: [],
      });
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
