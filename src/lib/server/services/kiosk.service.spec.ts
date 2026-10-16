import { KIOSK_CHECK_IN_STATUS } from '$lib/remotes/dtos/kiosk.dto';
import type { DayPass, Member, MemberSubscription } from '$lib/server/db/schema';
import type { MemberAccessContext } from '$lib/server/utils/member_access';
import { DateTime } from 'luxon';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KioskService } from './kiosk.service';

vi.mock('$env/dynamic/private', () => ({ env: {} }));

const NOW = DateTime.fromISO('2026-10-16T15:00:00', { zone: 'America/Chicago' }) as DateTime<true>;
const TODAY = '2026-10-16';

const member: Member = {
  id: 'member-1',
  email: 'ada@example.com',
  name: 'Ada Lovelace',
  phone: null,
  squareCustomerId: null,
  passToken: 'pass-token-1',
  onboardingToken: 'onboarding-token-1',
  createdDate: NOW,
};

const activeSubscription: MemberSubscription = {
  id: 'sub-1',
  memberId: member.id,
  planVariationId: 'plan-1',
  planName: 'Monthly',
  status: 'active',
  startDate: '2026-01-01',
  chargedThroughDate: null,
  canceledDate: null,
  accessEndedDate: null,
  refundedPaymentId: null,
  updatedDate: NOW,
};

function dayPass(overrides: Partial<DayPass>): DayPass {
  return {
    id: 'pass-1',
    memberId: member.id,
    squareOrderId: 'order-1',
    purchasedDate: NOW.minus({ days: 3 }),
    usedDate: null,
    ...overrides,
  };
}

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

describe('KioskService', () => {
  let service: KioskService;
  let memberRepository: any;
  let visitRepository: any;
  let dayPassRepository: any;
  let waiverRepository: any;
  let settingsRepository: any;

  beforeEach(() => {
    memberRepository = {
      getByPassToken: vi.fn().mockResolvedValue(member),
      getAccessContext: vi.fn().mockResolvedValue(context()),
    };
    visitRepository = { create: vi.fn() };
    dayPassRepository = { markUsed: vi.fn() };
    waiverRepository = { submit: vi.fn() };
    settingsRepository = { getSetting: vi.fn(), setSetting: vi.fn() };

    service = new KioskService(
      undefined,
      undefined,
      undefined,
      undefined,
      settingsRepository,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      waiverRepository,
      undefined,
      undefined,
      { memberRepository, visitRepository, dayPassRepository },
    );
  });

  describe('checkIn', () => {
    it('reads the pass token out of a scanned pass URL', async () => {
      await service.checkIn(`https://example.com/pass/${member.passToken}?ref=qr`, NOW);

      expect(memberRepository.getByPassToken).toHaveBeenCalledWith(member.passToken);
    });

    it('reports unknown passes without recording a visit', async () => {
      memberRepository.getByPassToken.mockResolvedValue(undefined);

      const result = await service.checkIn('nope', NOW);

      expect(result).toEqual({ status: KIOSK_CHECK_IN_STATUS.UNKNOWN_PASS });
      expect(visitRepository.create).not.toHaveBeenCalled();
    });

    it('asks for a waiver and records the denial when none is on file', async () => {
      memberRepository.getAccessContext.mockResolvedValue(
        context({ hasWaiver: false, subscriptions: [activeSubscription] }),
      );

      const result = await service.checkIn(member.passToken, NOW);

      expect(result).toEqual({
        status: KIOSK_CHECK_IN_STATUS.NEEDS_WAIVER,
        passToken: member.passToken,
        name: member.name,
        email: member.email,
      });
      expect(visitRepository.create).toHaveBeenCalledExactlyOnceWith({
        memberId: member.id,
        source: 'kiosk',
        accessBasis: 'subscription',
        outcome: 'denied_no_waiver',
      });
    });

    it('does not use a day pass when the member still needs a waiver', async () => {
      memberRepository.getAccessContext.mockResolvedValue(
        context({ hasWaiver: false, dayPasses: [dayPass({})] }),
      );

      await service.checkIn(member.passToken, NOW);

      expect(dayPassRepository.markUsed).not.toHaveBeenCalled();
    });

    it('denies members without any access', async () => {
      const result = await service.checkIn(member.passToken, NOW);

      expect(result).toEqual({ status: KIOSK_CHECK_IN_STATUS.DENIED, name: member.name });
      expect(visitRepository.create).toHaveBeenCalledExactlyOnceWith({
        memberId: member.id,
        source: 'kiosk',
        accessBasis: 'none',
        outcome: 'denied_no_access',
      });
    });

    it('admits members with an active subscription', async () => {
      memberRepository.getAccessContext.mockResolvedValue(
        context({ subscriptions: [activeSubscription] }),
      );

      const result = await service.checkIn(member.passToken, NOW);

      expect(result).toEqual({
        status: KIOSK_CHECK_IN_STATUS.ADMITTED,
        name: member.name,
        basis: 'subscription',
      });
      expect(dayPassRepository.markUsed).not.toHaveBeenCalled();
      expect(visitRepository.create).toHaveBeenCalledExactlyOnceWith({
        memberId: member.id,
        source: 'kiosk',
        accessBasis: 'subscription',
        outcome: 'admitted',
      });
    });

    it('uses an unused day pass for today', async () => {
      memberRepository.getAccessContext.mockResolvedValue(
        context({ dayPasses: [dayPass({ id: 'unused-pass' })] }),
      );

      const result = await service.checkIn(member.passToken, NOW);

      expect(result).toEqual({
        status: KIOSK_CHECK_IN_STATUS.ADMITTED,
        name: member.name,
        basis: 'day_pass',
      });
      expect(dayPassRepository.markUsed).toHaveBeenCalledExactlyOnceWith('unused-pass', TODAY);
      expect(visitRepository.create).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ accessBasis: 'day_pass', outcome: 'admitted' }),
      );
    });

    it('re-admits on a day pass already used today without using another', async () => {
      memberRepository.getAccessContext.mockResolvedValue(
        context({
          dayPasses: [dayPass({ id: 'used-pass', usedDate: TODAY }), dayPass({ id: 'spare' })],
        }),
      );

      const result = await service.checkIn(member.passToken, NOW);

      expect(result).toMatchObject({ status: KIOSK_CHECK_IN_STATUS.ADMITTED, basis: 'day_pass' });
      expect(dayPassRepository.markUsed).not.toHaveBeenCalled();
      expect(visitRepository.create).toHaveBeenCalledOnce();
    });
  });

  describe('submitWaiver', () => {
    const signature = new File(['ink'], 'signature.jpg');

    it('saves a kiosk waiver with the member email, then checks the member in', async () => {
      memberRepository.getAccessContext.mockResolvedValue(
        context({ subscriptions: [activeSubscription] }),
      );

      const result = await service.submitWaiver(
        { passToken: member.passToken, name: 'Ada King', signature, isAdult: true },
        NOW,
      );

      expect(waiverRepository.submit).toHaveBeenCalledWith(
        { name: 'Ada King', email: member.email, signature, isAdult: true },
        member.id,
        'kiosk',
      );
      expect(result).toMatchObject({ status: KIOSK_CHECK_IN_STATUS.ADMITTED });
      expect(visitRepository.create).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ outcome: 'admitted' }),
      );
    });

    it('rejects unknown pass tokens without saving a waiver', async () => {
      memberRepository.getByPassToken.mockResolvedValue(undefined);

      const result = await service.submitWaiver(
        { passToken: 'nope', name: 'Ada', signature, isAdult: true },
        NOW,
      );

      expect(result).toEqual({ status: KIOSK_CHECK_IN_STATUS.UNKNOWN_PASS });
      expect(waiverRepository.submit).not.toHaveBeenCalled();
    });
  });

  describe('device pairing', () => {
    it('accepts only the current device token', async () => {
      settingsRepository.getSetting.mockResolvedValue({ deviceToken: 'current' });

      expect(await service.isPairedDevice('current')).toBe(true);
      expect(await service.isPairedDevice('old')).toBe(false);
      expect(await service.isPairedDevice(undefined)).toBe(false);
    });

    it('rejects every device before a token is generated', async () => {
      settingsRepository.getSetting.mockResolvedValue({ deviceToken: '' });

      expect(await service.isPairedDevice('')).toBe(false);
      expect(await service.isPairedDevice('anything')).toBe(false);
    });

    it('stores a fresh token on rotate and returns its pairing link', async () => {
      const first = await service.rotateDeviceToken();
      const second = await service.rotateDeviceToken();

      const [[, stored]] = settingsRepository.setSetting.mock.calls;
      expect(first.pairingPath).toBe(`/kiosk/pair?token=${stored.deviceToken}`);
      expect(second.pairingPath).not.toBe(first.pairingPath);
    });

    it('has no pairing link before a token is generated', async () => {
      settingsRepository.getSetting.mockResolvedValue({ deviceToken: '' });

      expect(await service.getPairing()).toEqual({ pairingPath: null });
    });
  });
});
