import { SPACE_ZONE } from '$lib/utils/space';
import {
  CAR_BAY_STATUS,
  CAR_BAY_TIER,
  CarBayRuleError,
  CarBayRules,
  CarBaySlotTakenError,
  DEFAULT_CAR_BAY_POLICY,
} from '$lib/utils/car-bay';
import { describeWithDatabase, useTestDatabase } from '$test/db';
import { DateTime } from 'luxon';
import { beforeEach, describe, expect, it } from 'vitest';
import { CarBayRepository } from './car-bay.repository';

const rules = new CarBayRules(DEFAULT_CAR_BAY_POLICY);

function at(iso: string) {
  return DateTime.fromISO(iso, { zone: SPACE_ZONE });
}

function booking(start: string, end: string) {
  const endAt = at(end);
  return {
    tier: CAR_BAY_TIER.HOURLY,
    status: CAR_BAY_STATUS.CONFIRMED,
    startAt: at(start),
    endAt,
    blockedUntil: rules.blockedUntil(endAt),
    isMember: true,
    customerName: 'Jane Doe',
    customerEmail: 'jane@example.com',
    customerPhone: '555-0100',
  };
}

describeWithDatabase(CarBayRepository.name, () => {
  const database = useTestDatabase('car_bay');
  let repository: CarBayRepository;

  beforeEach(() => {
    repository = new CarBayRepository(database.db);
  });

  describe('overlap constraint', () => {
    it('rejects a booking that overlaps a confirmed one', async () => {
      await repository.create(booking('2026-10-17T12:00', '2026-10-17T14:00'));

      await expect(
        repository.create(booking('2026-10-17T13:00', '2026-10-17T15:00')),
      ).rejects.toThrow(CarBaySlotTakenError);
    });

    it('rejects a booking that starts inside the buffer after another', async () => {
      await repository.create(booking('2026-10-17T12:00', '2026-10-17T14:00'));

      await expect(
        repository.create(booking('2026-10-17T14:15', '2026-10-17T16:15')),
      ).rejects.toThrow(CarBaySlotTakenError);
      await expect(
        repository.create(booking('2026-10-17T14:30', '2026-10-17T16:30')),
      ).resolves.toBeDefined();
    });

    it('frees the time once a booking is canceled or a no-show', async () => {
      const canceled = await repository.create(booking('2026-10-17T12:00', '2026-10-17T14:00'));
      await repository.update(canceled.id, { status: CAR_BAY_STATUS.CANCELED });
      const noShow = await repository.create(booking('2026-10-17T12:00', '2026-10-17T14:00'));
      await repository.update(noShow.id, { status: CAR_BAY_STATUS.NO_SHOW });

      await expect(
        repository.create(booking('2026-10-17T12:00', '2026-10-17T14:00')),
      ).resolves.toBeDefined();
    });

    it('lets only one of two simultaneous checkouts win', async () => {
      const results = await Promise.allSettled([
        repository.create(booking('2026-10-17T12:00', '2026-10-17T14:00')),
        repository.create(booking('2026-10-17T13:00', '2026-10-17T15:00')),
      ]);

      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    });
  });

  describe('getConfirmedInRange', () => {
    it('includes a booking whose cleanup buffer reaches into the range', async () => {
      const earlier = await repository.create(booking('2026-10-17T10:00', '2026-10-17T12:00'));

      const found = await repository.getConfirmedInRange(
        at('2026-10-17T12:00'),
        at('2026-10-17T18:00'),
      );

      expect(found.map(({ id }) => id)).toEqual([earlier.id]);
    });

    it('leaves out canceled bookings and ones starting at the end of the range', async () => {
      const canceled = await repository.create(booking('2026-10-17T12:00', '2026-10-17T13:00'));
      await repository.update(canceled.id, { status: CAR_BAY_STATUS.CANCELED });
      await repository.create(booking('2026-10-17T18:00', '2026-10-17T19:00'));

      const found = await repository.getConfirmedInRange(
        at('2026-10-17T12:00'),
        at('2026-10-17T18:00'),
      );

      expect(found).toEqual([]);
    });
  });

  describe('hasConfirmedForCustomer', () => {
    const from = at('2026-10-17T00:00');
    const to = at('2026-10-18T00:00');

    it('finds a confirmed booking of the tier starting in the range', async () => {
      const { customerEmail, tier } = await repository.create(
        booking('2026-10-17T12:00', '2026-10-17T13:00'),
      );

      expect(await repository.hasConfirmedForCustomer(customerEmail, tier, from, to)).toBe(true);
    });

    it('ignores other tiers, other customers and canceled bookings', async () => {
      const { id, customerEmail } = await repository.create(
        booking('2026-10-17T12:00', '2026-10-17T13:00'),
      );
      await repository.update(id, { status: CAR_BAY_STATUS.CANCELED });

      expect(
        await repository.hasConfirmedForCustomer(customerEmail, CAR_BAY_TIER.HOURLY, from, to),
      ).toBe(false);
      expect(
        await repository.hasConfirmedForCustomer(customerEmail, CAR_BAY_TIER.FULL_DAY, from, to),
      ).toBe(false);
      expect(
        await repository.hasConfirmedForCustomer(
          'other@example.com',
          CAR_BAY_TIER.HOURLY,
          from,
          to,
        ),
      ).toBe(false);
    });
  });

  describe('getReminderCandidates', () => {
    it('returns unreminded bookings starting after now and up to the cutoff', async () => {
      const now = at('2026-10-17T08:00');
      const due = await repository.create(booking('2026-10-17T12:00', '2026-10-17T13:00'));
      const reminded = await repository.create(booking('2026-10-17T15:00', '2026-10-17T16:00'));
      await repository.update(reminded.id, { reminderSentDate: now });
      await repository.create(booking('2026-10-18T12:00', '2026-10-18T13:00'));

      const candidates = await repository.getReminderCandidates(now, now.plus({ days: 1 }));

      expect(candidates.map(({ id }) => id)).toEqual([due.id]);
    });
  });

  describe('createClosure', () => {
    it('refuses a closure that overlaps another', async () => {
      const closure = { startAt: at('2026-10-17T00:00'), endAt: at('2026-10-18T00:00') };
      await repository.createClosure(closure);

      await expect(
        repository.createClosure({ ...closure, startAt: at('2026-10-17T12:00') }),
      ).rejects.toThrow(CarBayRuleError);
    });
  });
});
