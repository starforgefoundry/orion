import { KIOSK_CHECK_IN_STATUS } from '$lib/remotes/dtos/kiosk.dto';
import type { DayPass } from '$lib/server/db/schema';
import type { MemberAccessContext } from '$lib/server/utils/member_access';
import { factory } from '$test/factory';
import { newTestService, stubSettings, type ServiceMocks } from '$test/utils';
import { DateTime } from 'luxon';
import { beforeEach, describe, expect, it } from 'vitest';
import { KioskService } from './kiosk.service';

const NOW = DateTime.fromISO('2026-10-16T15:00:00', { zone: 'America/Chicago' }) as DateTime<true>;
const TODAY = '2026-10-16';

const member = factory.member({ name: 'Ada Lovelace', email: 'ada@example.com' });

const activeSubscription = factory.memberSubscription({
  memberId: member.id,
  startDate: '2026-01-01',
});

function dayPass(overrides: Partial<DayPass> = {}) {
  return factory.dayPass({
    memberId: member.id,
    purchasedDate: NOW.minus({ days: 3 }),
    ...overrides,
  });
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

describe(KioskService.name, () => {
  let sut: KioskService;
  let mocks: ServiceMocks;

  beforeEach(() => {
    ({ sut, mocks } = newTestService(KioskService));
    mocks.memberRepository.getByPassToken.mockResolvedValue(member);
    mocks.memberRepository.getAccessContext.mockResolvedValue(context());
    mocks.visitRepository.create.mockResolvedValue(factory.visit({ memberId: member.id }));
    mocks.dayPassRepository.markUsed.mockResolvedValue();
    mocks.waiverRepository.submit.mockResolvedValue(factory.waiver({ memberId: member.id }));
  });

  describe('checkIn', () => {
    it('reads the pass token out of a scanned pass URL', async () => {
      await sut.checkIn(`https://example.com/pass/${member.passToken}?ref=qr`, NOW);

      expect(mocks.memberRepository.getByPassToken).toHaveBeenCalledWith(member.passToken);
    });

    it('reports unknown passes without recording a visit', async () => {
      mocks.memberRepository.getByPassToken.mockResolvedValue(undefined as never);

      const result = await sut.checkIn('nope', NOW);

      expect(result).toEqual({ status: KIOSK_CHECK_IN_STATUS.UNKNOWN_PASS });
      expect(mocks.visitRepository.create).not.toHaveBeenCalled();
    });

    it('asks for a waiver and records the denial when none is on file', async () => {
      mocks.memberRepository.getAccessContext.mockResolvedValue(
        context({ hasWaiver: false, subscriptions: [activeSubscription] }),
      );

      const result = await sut.checkIn(member.passToken, NOW);

      expect(result).toEqual({
        status: KIOSK_CHECK_IN_STATUS.NEEDS_WAIVER,
        passToken: member.passToken,
        name: member.name,
        email: member.email,
      });
      expect(mocks.visitRepository.create).toHaveBeenCalledExactlyOnceWith({
        memberId: member.id,
        source: 'kiosk',
        accessBasis: 'subscription',
        outcome: 'denied_no_waiver',
      });
    });

    it('does not use a day pass when the member still needs a waiver', async () => {
      mocks.memberRepository.getAccessContext.mockResolvedValue(
        context({ hasWaiver: false, dayPasses: [dayPass()] }),
      );

      await sut.checkIn(member.passToken, NOW);

      expect(mocks.dayPassRepository.markUsed).not.toHaveBeenCalled();
    });

    it('denies members without any access', async () => {
      const result = await sut.checkIn(member.passToken, NOW);

      expect(result).toEqual({ status: KIOSK_CHECK_IN_STATUS.DENIED, name: member.name });
      expect(mocks.visitRepository.create).toHaveBeenCalledExactlyOnceWith({
        memberId: member.id,
        source: 'kiosk',
        accessBasis: 'none',
        outcome: 'denied_no_access',
      });
    });

    it('admits members with an active subscription', async () => {
      mocks.memberRepository.getAccessContext.mockResolvedValue(
        context({ subscriptions: [activeSubscription] }),
      );

      const result = await sut.checkIn(member.passToken, NOW);

      expect(result).toEqual({
        status: KIOSK_CHECK_IN_STATUS.ADMITTED,
        name: member.name,
        basis: 'subscription',
      });
      expect(mocks.dayPassRepository.markUsed).not.toHaveBeenCalled();
      expect(mocks.visitRepository.create).toHaveBeenCalledExactlyOnceWith({
        memberId: member.id,
        source: 'kiosk',
        accessBasis: 'subscription',
        outcome: 'admitted',
      });
    });

    it('uses an unused day pass for today', async () => {
      const unused = dayPass();
      mocks.memberRepository.getAccessContext.mockResolvedValue(context({ dayPasses: [unused] }));

      const result = await sut.checkIn(member.passToken, NOW);

      expect(result).toEqual({
        status: KIOSK_CHECK_IN_STATUS.ADMITTED,
        name: member.name,
        basis: 'day_pass',
      });
      expect(mocks.dayPassRepository.markUsed).toHaveBeenCalledExactlyOnceWith(unused.id, TODAY);
      expect(mocks.visitRepository.create).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ accessBasis: 'day_pass', outcome: 'admitted' }),
      );
    });

    it('re-admits on a day pass already used today without using another', async () => {
      mocks.memberRepository.getAccessContext.mockResolvedValue(
        context({ dayPasses: [dayPass({ usedDate: TODAY }), dayPass()] }),
      );

      const result = await sut.checkIn(member.passToken, NOW);

      expect(result).toMatchObject({ status: KIOSK_CHECK_IN_STATUS.ADMITTED, basis: 'day_pass' });
      expect(mocks.dayPassRepository.markUsed).not.toHaveBeenCalled();
      expect(mocks.visitRepository.create).toHaveBeenCalledOnce();
    });
  });

  describe('submitWaiver', () => {
    const signature = new File(['ink'], 'signature.jpg');

    it('saves a kiosk waiver with the member email, then checks the member in', async () => {
      mocks.memberRepository.getAccessContext.mockResolvedValue(
        context({ subscriptions: [activeSubscription] }),
      );

      const result = await sut.submitWaiver(
        { passToken: member.passToken, name: 'Ada King', signature, isAdult: true },
        NOW,
      );

      expect(mocks.waiverRepository.submit).toHaveBeenCalledWith(
        { name: 'Ada King', email: member.email, signature, isAdult: true },
        member.id,
        'kiosk',
      );
      expect(result).toMatchObject({ status: KIOSK_CHECK_IN_STATUS.ADMITTED });
      expect(mocks.visitRepository.create).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ outcome: 'admitted' }),
      );
    });

    it('rejects unknown pass tokens without saving a waiver', async () => {
      mocks.memberRepository.getByPassToken.mockResolvedValue(undefined as never);

      const result = await sut.submitWaiver(
        { passToken: 'nope', name: 'Ada', signature, isAdult: true },
        NOW,
      );

      expect(result).toEqual({ status: KIOSK_CHECK_IN_STATUS.UNKNOWN_PASS });
      expect(mocks.waiverRepository.submit).not.toHaveBeenCalled();
    });
  });

  describe('device pairing', () => {
    it('accepts only the current device token', async () => {
      stubSettings(mocks.settingsRepository, { kiosk: { deviceToken: 'current' } });

      expect(await sut.isPairedDevice('current')).toBe(true);
      expect(await sut.isPairedDevice('old')).toBe(false);
      expect(await sut.isPairedDevice(undefined)).toBe(false);
    });

    it('rejects every device before a token is generated', async () => {
      stubSettings(mocks.settingsRepository, { kiosk: { deviceToken: '' } });

      expect(await sut.isPairedDevice('')).toBe(false);
      expect(await sut.isPairedDevice('anything')).toBe(false);
    });

    it('stores a fresh token on rotate and returns its pairing link', async () => {
      mocks.settingsRepository.setSetting.mockImplementation(async (_key, value) => value);

      const first = await sut.rotateDeviceToken();
      const second = await sut.rotateDeviceToken();

      const [[, stored]] = mocks.settingsRepository.setSetting.mock.calls;
      expect(first.pairingPath).toBe(
        `/kiosk/pair?token=${(stored as { deviceToken: string }).deviceToken}`,
      );
      expect(second.pairingPath).not.toBe(first.pairingPath);
    });

    it('has no pairing link before a token is generated', async () => {
      stubSettings(mocks.settingsRepository, { kiosk: { deviceToken: '' } });

      expect(await sut.getPairing()).toEqual({ pairingPath: null });
    });
  });
});
