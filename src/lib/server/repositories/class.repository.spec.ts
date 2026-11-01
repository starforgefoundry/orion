import type { ClassBooking, ClassInstance } from '$lib/server/db/schema';
import { CLASS_BOOKING_STATUS, CLASS_INSTANCE_STATUS } from '$lib/utils/classes';
import { describeWithDatabase, useTestDatabase } from '$test/db';
import { DateTime } from 'luxon';
import { beforeEach, describe, expect, it } from 'vitest';
import { ClassRepository } from './class.repository';

describeWithDatabase(ClassRepository.name, () => {
  const database = useTestDatabase('class');
  let repository: ClassRepository;
  let teacherEmail: string;

  beforeEach(async () => {
    repository = new ClassRepository(database.db);
    ({ email: teacherEmail } = await database.insert.user());
  });

  async function addInstance(overrides: Partial<ClassInstance> = {}) {
    const catalog = await database.insert.classCatalog();
    return await database.insert.classInstance({ classId: catalog.id, teacherEmail, ...overrides });
  }

  async function book(
    instanceId: string,
    quantity: number,
    status: ClassBooking['status'] = CLASS_BOOKING_STATUS.CONFIRMED,
  ) {
    return await database.insert.classBooking({ instanceId, status, quantity });
  }

  describe('getConfirmedSeatCounts', () => {
    it('sums confirmed seats per instance and skips canceled bookings', async () => {
      const first = await addInstance();
      const second = await addInstance();
      const empty = await addInstance();
      await book(first.id, 2);
      await book(first.id, 3);
      await book(first.id, 4, CLASS_BOOKING_STATUS.CANCELED);
      await book(second.id, 1);

      const counts = await repository.getConfirmedSeatCounts([first.id, second.id, empty.id]);

      expect(counts).toEqual(
        new Map([
          [first.id, 5],
          [second.id, 1],
        ]),
      );
    });

    it('returns no counts for no instances', async () => {
      expect(await repository.getConfirmedSeatCounts([])).toEqual(new Map());
    });
  });

  describe('getConfirmedBookingCount', () => {
    it('sums confirmed seats for one instance', async () => {
      const instance = await addInstance();
      await book(instance.id, 2);
      await book(instance.id, 3, CLASS_BOOKING_STATUS.CANCELED);

      expect(await repository.getConfirmedBookingCount(instance.id)).toBe(2);
    });

    it('is zero for an instance with no bookings', async () => {
      const instance = await addInstance();

      expect(await repository.getConfirmedBookingCount(instance.id)).toBe(0);
    });
  });

  describe('getScheduledInstances', () => {
    it('lists scheduled instances with only the public teacher fields', async () => {
      const scheduled = await addInstance();
      await addInstance({ status: CLASS_INSTANCE_STATUS.CANCELED });

      const instances = await repository.getScheduledInstances();

      expect(instances.map((instance) => instance.id)).toEqual([scheduled.id]);
      expect(instances[0].teacher).toEqual({
        name: expect.any(String),
        picture: expect.any(String),
      });
    });

    it('limits the list to one catalog when given', async () => {
      const wanted = await addInstance();
      await addInstance();

      const instances = await repository.getScheduledInstances(wanted.classId);

      expect(instances.map((instance) => instance.id)).toEqual([wanted.id]);
    });
  });

  describe('getScheduledInstancesByRecurrenceGroup', () => {
    it('returns scheduled instances of the group from the given date on', async () => {
      const recurrenceGroupId = crypto.randomUUID();
      const catalog = await database.insert.classCatalog();
      const inGroup = (
        date: string,
        status: ClassInstance['status'] = CLASS_INSTANCE_STATUS.SCHEDULED,
      ) =>
        database.insert.classInstance({
          classId: catalog.id,
          teacherEmail,
          recurrenceGroupId,
          date,
          status,
        });
      await inGroup('2026-10-07');
      const onDate = await inGroup('2026-10-14');
      const later = await inGroup('2026-10-21');
      await inGroup('2026-10-28', CLASS_INSTANCE_STATUS.CANCELED);
      await addInstance({ date: '2026-10-21' });

      const instances = await repository.getScheduledInstancesByRecurrenceGroup(
        recurrenceGroupId,
        '2026-10-14',
      );

      expect(instances.map((instance) => instance.id).toSorted()).toEqual(
        [onDate.id, later.id].toSorted(),
      );
    });
  });

  describe('getReminderCandidates', () => {
    it('returns confirmed, unreminded bookings for scheduled classes in the date range', async () => {
      const inRange = await addInstance({ date: '2026-10-16' });
      const due = await book(inRange.id, 1);
      await book(inRange.id, 1, CLASS_BOOKING_STATUS.CANCELED);
      await database.insert.classBooking({
        instanceId: inRange.id,
        reminderSentDate: DateTime.now(),
      });
      const canceledClass = await addInstance({
        date: '2026-10-16',
        status: CLASS_INSTANCE_STATUS.CANCELED,
      });
      await book(canceledClass.id, 1);
      const outOfRange = await addInstance({ date: '2026-10-18' });
      await book(outOfRange.id, 1);

      const candidates = await repository.getReminderCandidates('2026-10-15', '2026-10-17');

      expect(candidates.map(({ booking }) => booking.id)).toEqual([due.id]);
    });
  });

  describe('getBookingByToken', () => {
    it('returns the booking with its instance, catalog and payment', async () => {
      const instance = await addInstance();
      const payment = await database.insert.payment();
      const booking = await database.insert.classBooking({
        instanceId: instance.id,
        paymentId: payment.id,
      });

      expect(await repository.getBookingByToken(booking.bookingToken)).toMatchObject({
        id: booking.id,
        instance: { id: instance.id },
        catalog: { id: instance.classId },
        payment: { id: payment.id },
      });
    });

    it('returns null for an unknown token', async () => {
      expect(await repository.getBookingByToken(crypto.randomUUID())).toBeNull();
    });
  });
});
