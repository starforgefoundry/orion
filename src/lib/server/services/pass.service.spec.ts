import {
  appleWalletConfig,
  buildApplePass,
  type AppleWalletConfig,
} from '$lib/server/utils/apple_wallet';
import {
  googleWalletConfig,
  googleWalletSaveUrl,
  type GoogleWalletConfig,
} from '$lib/server/utils/google_wallet';
import { SPACE_ZONE } from '$lib/space';
import { factory } from '$test/factory';
import { newTestService, type ServiceMocks } from '$test/utils';
import { DateTime } from 'luxon';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PassService } from './pass.service';

vi.mock('$lib/server/utils/google_wallet', () => ({
  googleWalletConfig: vi.fn(),
  googleWalletSaveUrl: vi.fn(() => 'https://pay.google.com/gp/v/save/jwt'),
}));

vi.mock('$lib/server/utils/apple_wallet', () => ({
  appleWalletConfig: vi.fn(),
  buildApplePass: vi.fn(() => Buffer.from('pkpass')),
}));

const GOOGLE_CONFIG = { issuerId: 'issuer' } as GoogleWalletConfig;
const APPLE_CONFIG = { passTypeId: 'pass.test' } as AppleWalletConfig;
const GIF_SIGNATURE = 'GIF8';

const MEMBER = factory.member({
  name: 'Sam Smith',
  passToken: 'token-abc',
  createdDate: DateTime.fromISO('2026-03-01T12:00:00', { zone: SPACE_ZONE }),
});

const MEMBERSHIP = factory.membershipPass({ member: MEMBER });

const DAY_PASS = factory.dayPassTicket({
  member: MEMBER,
  dayPass: factory.dayPass({
    passToken: 'token-day',
    purchasedDate: DateTime.fromISO('2026-10-02T12:00:00', { zone: SPACE_ZONE }),
  }),
});

const CLASS_PASS = factory.classPass({
  booking: factory.classBooking({
    customerName: 'Jo Booker',
    passToken: 'token-class',
    quantity: 3,
  }),
  instance: factory.classInstance({ date: '2026-10-20', startTime: '18:30', durationMinutes: 90 }),
  catalog: factory.classCatalog({ name: 'Intro to Welding' }),
});

const CAR_BAY_PASS = factory.carBayPass({
  booking: factory.carBayBooking({
    customerName: 'Jo Booker',
    passToken: 'token-bay',
    tier: 'hourly',
    startAt: DateTime.fromISO('2026-10-21T16:00', { zone: SPACE_ZONE }),
    endAt: DateTime.fromISO('2026-10-21T18:00', { zone: SPACE_ZONE }),
  }),
});

describe(PassService.name, () => {
  let sut: PassService;
  let mocks: ServiceMocks;

  beforeEach(() => {
    ({ sut, mocks } = newTestService(PassService));
    mocks.passRepository.getByToken.mockResolvedValue(MEMBERSHIP);
  });

  describe('getPass', () => {
    it('returns undefined for an unknown token', async () => {
      mocks.passRepository.getByToken.mockResolvedValue(undefined);
      expect(await sut.getPass('nope')).toBeUndefined();
    });

    it('labels a member pass as a membership', async () => {
      expect(await sut.getPass('token-abc')).toEqual({
        title: 'Membership',
        holderName: 'Sam Smith',
        passUrl: 'https://orion.example.com/pass/token-abc',
        fields: [{ key: 'memberSince', label: 'Member since', value: 'Mar 2026' }],
        wallets: [],
      });
    });

    it('offers Google Wallet when it is configured', async () => {
      vi.mocked(googleWalletConfig).mockReturnValue(GOOGLE_CONFIG);
      expect((await sut.getPass('token-abc'))?.wallets).toEqual(['google']);
    });

    it('offers both wallets when both are configured', async () => {
      vi.mocked(googleWalletConfig).mockReturnValue(GOOGLE_CONFIG);
      vi.mocked(appleWalletConfig).mockReturnValue(APPLE_CONFIG);
      expect((await sut.getPass('token-abc'))?.wallets).toEqual(['apple', 'google']);
    });

    it('labels a day pass with its purchase date', async () => {
      mocks.passRepository.getByToken.mockResolvedValue(DAY_PASS);
      expect(await sut.getPass('token-day')).toMatchObject({
        title: 'Day Pass',
        passUrl: 'https://orion.example.com/pass/token-day',
        fields: [{ label: 'Purchased', value: 'Oct 2, 2026' }],
      });
    });

    it('shows the class, when it is and how many spots for a class pass', async () => {
      mocks.passRepository.getByToken.mockResolvedValue(CLASS_PASS);
      expect(await sut.getPass('token-class')).toMatchObject({
        title: 'Class Pass',
        holderName: 'Jo Booker',
        fields: [
          { label: 'Class', value: 'Intro to Welding' },
          { label: 'Date', value: 'Tuesday, October 20, 2026' },
          { label: 'Time', value: '6:30 PM' },
          { label: 'Spots', value: '3' },
        ],
      });
    });

    it('shows the tier and booked time for a car bay pass', async () => {
      mocks.passRepository.getByToken.mockResolvedValue(CAR_BAY_PASS);
      expect(await sut.getPass('token-bay')).toMatchObject({
        title: 'Car Bay Pass',
        fields: [
          { label: 'Booking', value: 'Hourly' },
          { label: 'When', value: 'Wednesday, October 21, 4:00 PM – 6:00 PM' },
        ],
      });
    });
  });

  describe('getApplePass', () => {
    it('returns undefined when Apple Wallet is not configured', async () => {
      expect(await sut.getApplePass('token-abc')).toBeUndefined();
      expect(mocks.passRepository.getByToken).not.toHaveBeenCalled();
    });

    it('returns undefined for an unknown token', async () => {
      vi.mocked(appleWalletConfig).mockReturnValue(APPLE_CONFIG);
      mocks.passRepository.getByToken.mockResolvedValue(undefined);
      expect(await sut.getApplePass('nope')).toBeUndefined();
    });

    it('builds a pass that expires when the class ends', async () => {
      vi.mocked(appleWalletConfig).mockReturnValue(APPLE_CONFIG);
      mocks.passRepository.getByToken.mockResolvedValue(CLASS_PASS);

      expect((await sut.getApplePass('token-class'))?.toString()).toBe('pkpass');
      const [details, config] = vi.mocked(buildApplePass).mock.lastCall!;
      expect(config).toBe(APPLE_CONFIG);
      expect(details.serial).toBe('class-token-class');
      expect(details.relevantDate?.toISO()).toBe('2026-10-20T18:30:00.000-05:00');
      expect(details.expiresAt?.toISO()).toBe('2026-10-20T20:00:00.000-05:00');
    });

    it('keeps the member id as the membership serial so saved passes stay the same pass', async () => {
      vi.mocked(appleWalletConfig).mockReturnValue(APPLE_CONFIG);
      await sut.getApplePass('token-abc');
      expect(buildApplePass).toHaveBeenCalledWith(
        expect.objectContaining({ serial: MEMBER.id }),
        APPLE_CONFIG,
      );
    });
  });

  describe('getGoogleWalletUrl', () => {
    it('returns undefined when Google Wallet is not configured', async () => {
      expect(await sut.getGoogleWalletUrl('token-abc')).toBeUndefined();
      expect(mocks.passRepository.getByToken).not.toHaveBeenCalled();
    });

    it('returns a save link for the pass', async () => {
      vi.mocked(googleWalletConfig).mockReturnValue(GOOGLE_CONFIG);
      mocks.passRepository.getByToken.mockResolvedValue(CAR_BAY_PASS);

      expect(await sut.getGoogleWalletUrl('token-bay')).toBe(
        'https://pay.google.com/gp/v/save/jwt',
      );
      expect(googleWalletSaveUrl).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'car_bay', title: 'Car Bay Pass' }),
        GOOGLE_CONFIG,
      );
    });
  });

  describe('getQrImage', () => {
    it('returns undefined for an unknown token', async () => {
      mocks.passRepository.getByToken.mockResolvedValue(undefined);
      expect(await sut.getQrImage('nope')).toBeUndefined();
    });

    it('renders an image email clients can load', async () => {
      const image = await sut.getQrImage('token-abc');

      expect(image?.contentType).toBe('image/gif');
      expect(image?.body.subarray(0, GIF_SIGNATURE.length).toString()).toBe(GIF_SIGNATURE);
    });
  });
});
