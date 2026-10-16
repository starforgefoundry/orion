import type { Member } from '$lib/server/db/schema';
import type { MemberAccessContext } from '$lib/server/utils/member_access';
import {
  appleWalletConfig,
  buildApplePass,
  type AppleWalletConfig,
} from '$lib/server/utils/apple_wallet';
import { googleWalletConfig, type GoogleWalletConfig } from '$lib/server/utils/google_wallet';
import { DateTime } from 'luxon';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OnboardingService, PASS_EMAIL_COOLDOWN } from './onboarding.service';

vi.mock('$env/dynamic/private', () => ({
  env: { FRONTEND_URL: 'https://orion.example.com' },
}));

vi.mock('$lib/server/utils/google_wallet', () => ({
  googleWalletConfig: vi.fn(),
  googleWalletSaveUrl: vi.fn(() => 'https://pay.google.com/gp/v/save/jwt'),
}));

vi.mock('$lib/server/utils/apple_wallet', () => ({
  appleWalletConfig: vi.fn(),
  buildApplePass: vi.fn(() => Buffer.from('pkpass')),
}));

const MEMBER: Member = {
  id: 'member-1',
  email: 'sam@example.com',
  name: 'Sam Smith',
  phone: null,
  squareCustomerId: null,
  passToken: 'token-abc',
  onboardingToken: 'onboarding-abc',
  createdDate: DateTime.now(),
};

const ACTIVE_CONTEXT: MemberAccessContext = {
  member: MEMBER,
  hasWaiver: true,
  subscriptions: [],
  organizations: [],
  dayPasses: [
    {
      id: 'pass-1',
      memberId: MEMBER.id,
      squareOrderId: 'order',
      purchasedDate: DateTime.now(),
      usedDate: null,
    },
  ],
};

const WALLET_CONFIG = { issuerId: 'issuer' } as GoogleWalletConfig;
const APPLE_CONFIG = { passTypeId: 'pass.test' } as AppleWalletConfig;
const SIGNATURE = new File(['sig'], 'signature.jpg');

describe('OnboardingService', () => {
  let service: OnboardingService;
  let memberRepo: {
    getByPassToken: ReturnType<typeof vi.fn>;
    getByOnboardingToken: ReturnType<typeof vi.fn>;
    getAccessContext: ReturnType<typeof vi.fn>;
    getAccessContextByEmail: ReturnType<typeof vi.fn>;
  };
  let waiverRepo: { submit: ReturnType<typeof vi.fn> };
  let memberEmailRepo: { listByMember: ReturnType<typeof vi.fn> };
  let notificationRepo: { sendOnboarding: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(googleWalletConfig).mockReturnValue(undefined);
    vi.mocked(appleWalletConfig).mockReturnValue(undefined);

    memberRepo = {
      getByPassToken: vi.fn().mockResolvedValue(MEMBER),
      getByOnboardingToken: vi.fn().mockResolvedValue(MEMBER),
      getAccessContext: vi.fn().mockResolvedValue({ hasWaiver: false }),
      getAccessContextByEmail: vi.fn().mockResolvedValue(ACTIVE_CONTEXT),
    };
    waiverRepo = { submit: vi.fn().mockResolvedValue({ id: 'waiver-1' }) };
    memberEmailRepo = { listByMember: vi.fn().mockResolvedValue([]) };
    notificationRepo = { sendOnboarding: vi.fn() };

    service = new OnboardingService(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      waiverRepo as never,
      undefined,
      undefined,
      {
        memberRepository: memberRepo as never,
        memberEmailRepository: memberEmailRepo as never,
        memberNotificationRepository: notificationRepo as never,
      },
    );
  });

  describe('getOnboarding', () => {
    it('returns undefined for an unknown token', async () => {
      memberRepo.getByOnboardingToken.mockResolvedValue(undefined);
      expect(await service.getOnboarding('nope')).toBeUndefined();
    });

    it('looks members up by onboarding token so a scanned QR cannot open it', async () => {
      await service.getOnboarding('onboarding-abc');

      expect(memberRepo.getByOnboardingToken).toHaveBeenCalledWith('onboarding-abc');
      expect(memberRepo.getByPassToken).not.toHaveBeenCalled();
    });

    it('reports waiver status and hides wallets that are not configured', async () => {
      expect(await service.getOnboarding('onboarding-abc')).toEqual({
        name: 'Sam Smith',
        email: 'sam@example.com',
        passToken: 'token-abc',
        passUrl: 'https://orion.example.com/pass/token-abc',
        hasWaiver: false,
        wallets: [],
      });
      expect(memberRepo.getAccessContext).toHaveBeenCalledWith('member-1');
    });

    // Google Wallet is hidden until publishing access is approved.
    it.skip('offers Google Wallet when it is configured', async () => {
      vi.mocked(googleWalletConfig).mockReturnValue(WALLET_CONFIG);
      memberRepo.getAccessContext.mockResolvedValue({ hasWaiver: true });

      const onboarding = await service.getOnboarding('token-abc');

      expect(onboarding?.hasWaiver).toBe(true);
      expect(onboarding?.wallets).toEqual(['google']);
    });

    it.skip('offers both wallets when both are configured', async () => {
      vi.mocked(googleWalletConfig).mockReturnValue(WALLET_CONFIG);
      vi.mocked(appleWalletConfig).mockReturnValue(APPLE_CONFIG);

      expect((await service.getOnboarding('token-abc'))?.wallets).toEqual(['apple', 'google']);
    });
  });

  describe('getApplePass', () => {
    it('returns undefined when Apple Wallet is not configured', async () => {
      expect(await service.getApplePass('token-abc')).toBeUndefined();
      expect(buildApplePass).not.toHaveBeenCalled();
    });

    it('returns undefined for an unknown token', async () => {
      vi.mocked(appleWalletConfig).mockReturnValue(APPLE_CONFIG);
      memberRepo.getByPassToken.mockResolvedValue(undefined);
      expect(await service.getApplePass('nope')).toBeUndefined();
    });

    it("builds the member's pass", async () => {
      vi.mocked(appleWalletConfig).mockReturnValue(APPLE_CONFIG);
      expect((await service.getApplePass('token-abc'))?.toString()).toBe('pkpass');
      expect(buildApplePass).toHaveBeenCalledWith(MEMBER, APPLE_CONFIG);
    });
  });

  describe('submitWaiver', () => {
    const dto = { token: 'onboarding-abc', name: 'Sam S', signature: SIGNATURE, isAdult: true };

    it("signs with the member's email regardless of the form", async () => {
      expect(await service.submitWaiver(dto)).toBe(true);
      expect(waiverRepo.submit).toHaveBeenCalledWith(
        { name: 'Sam S', email: 'sam@example.com', signature: SIGNATURE, isAdult: true },
        'member-1',
        'web',
      );
    });

    it('skips members who already signed', async () => {
      memberRepo.getAccessContext.mockResolvedValue({ hasWaiver: true });
      expect(await service.submitWaiver(dto)).toBe(true);
      expect(waiverRepo.submit).not.toHaveBeenCalled();
    });

    it('rejects unknown tokens', async () => {
      memberRepo.getByOnboardingToken.mockResolvedValue(undefined);
      expect(await service.submitWaiver(dto)).toBe(false);
      expect(waiverRepo.submit).not.toHaveBeenCalled();
    });
  });

  describe('getGoogleWalletUrl', () => {
    it('returns undefined when Google Wallet is not configured', async () => {
      expect(await service.getGoogleWalletUrl('token-abc')).toBeUndefined();
      expect(memberRepo.getByPassToken).not.toHaveBeenCalled();
    });

    it('returns a save link for the member', async () => {
      vi.mocked(googleWalletConfig).mockReturnValue(WALLET_CONFIG);
      expect(await service.getGoogleWalletUrl('token-abc')).toBe(
        'https://pay.google.com/gp/v/save/jwt',
      );
    });
  });

  describe('getMemberPass', () => {
    it('returns the name, QR value and configured wallets', async () => {
      expect(await service.getMemberPass('token-abc')).toEqual({
        name: 'Sam Smith',
        passUrl: 'https://orion.example.com/pass/token-abc',
        wallets: [],
      });
    });
  });

  describe('requestOnboardingEmail', () => {
    it('sends onboarding to a member with access', async () => {
      await service.requestOnboardingEmail('sam@example.com');

      expect(notificationRepo.sendOnboarding).toHaveBeenCalledWith(MEMBER, 'self_service');
    });

    it('sends nothing for an unknown email', async () => {
      memberRepo.getAccessContextByEmail.mockResolvedValue(undefined);

      await service.requestOnboardingEmail('nobody@example.com');

      expect(notificationRepo.sendOnboarding).not.toHaveBeenCalled();
    });

    it('sends nothing to a member without access', async () => {
      memberRepo.getAccessContextByEmail.mockResolvedValue({ ...ACTIVE_CONTEXT, dayPasses: [] });

      await service.requestOnboardingEmail('sam@example.com');

      expect(notificationRepo.sendOnboarding).not.toHaveBeenCalled();
    });

    it('sends nothing when an onboarding email went out within the cooldown', async () => {
      memberEmailRepo.listByMember.mockResolvedValue([
        { type: 'onboarding', sentDate: DateTime.now().minus({ minutes: 1 }) },
      ]);

      await service.requestOnboardingEmail('sam@example.com');

      expect(notificationRepo.sendOnboarding).not.toHaveBeenCalled();
    });

    it('sends again once the cooldown has passed', async () => {
      memberEmailRepo.listByMember.mockResolvedValue([
        {
          type: 'onboarding',
          sentDate: DateTime.now().minus(PASS_EMAIL_COOLDOWN).minus({ minutes: 1 }),
        },
      ]);

      await service.requestOnboardingEmail('sam@example.com');

      expect(notificationRepo.sendOnboarding).toHaveBeenCalled();
    });
  });
});
