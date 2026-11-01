import { SPACE_ZONE } from '$lib/space';
import { factory } from '$test/factory';
import { newTestService, type ServiceMocks } from '$test/utils';
import { DateTime } from 'luxon';
import { beforeEach, describe, expect, it } from 'vitest';
import { ClassService } from './class.service';

const NOW = DateTime.fromISO('2026-10-12T09:00', { zone: SPACE_ZONE });

describe(ClassService.name, () => {
  let sut: ClassService;
  let mocks: ServiceMocks;

  beforeEach(() => {
    ({ sut, mocks } = newTestService(ClassService));
    mocks.googleCalendarRepository.isConfigured.mockReturnValue(false);
  });

  describe('sendDueReminders', () => {
    const catalog = factory.classCatalog({ name: 'Welding Class' });

    function candidate(startsAt: DateTime, bookedAt: DateTime, id: string) {
      return {
        booking: factory.classBooking({
          id,
          createdDate: bookedAt,
          bookingToken: `tok-${id}`,
          passToken: `pass-${id}`,
        }),
        instance: factory.classInstance({
          date: startsAt.toISODate()!,
          startTime: startsAt.toFormat('HH:mm'),
        }),
        catalog,
      };
    }

    beforeEach(() => {
      mocks.mailgunGateway.sendTemplate.mockResolvedValue(undefined as never);
      mocks.classRepository.updateBooking.mockResolvedValue(factory.classBooking());
    });

    it('looks at classes from today through tomorrow', async () => {
      mocks.classRepository.getReminderCandidates.mockResolvedValue([]);

      await sut.sendDueReminders(NOW);

      expect(mocks.classRepository.getReminderCandidates).toHaveBeenCalledWith(
        '2026-10-12',
        '2026-10-13',
      );
    });

    it('reminds bookings for classes in the next 24 hours with their class pass', async () => {
      mocks.classRepository.getReminderCandidates.mockResolvedValue([
        candidate(NOW.plus({ hours: 20 }), NOW.minus({ days: 3 }), 'due'),
      ]);

      await sut.sendDueReminders(NOW);

      expect(mocks.mailgunGateway.sendTemplate).toHaveBeenCalledExactlyOnceWith(
        'customer@example.com',
        {
          from: 'Starforge Classes <classes@starforgefoundry.com>',
          replyTo: 'classes@starforgefoundry.com',
        },
        'class_reminder',
        expect.objectContaining({
          className: 'Welding Class',
          classDate: 'Tuesday, October 13, 2026',
          bookingUrl: 'https://orion.example.com/classes/booking/tok-due',
          passUrl: 'https://orion.example.com/pass/pass-due',
          passQrImageUrl: 'https://orion.example.com/api/pass/pass-due/qr',
        }),
      );
      expect(mocks.classRepository.updateBooking).toHaveBeenCalledWith('due', {
        reminderSentDate: NOW,
      });
    });

    it('skips classes that already started or are more than 24 hours out', async () => {
      mocks.classRepository.getReminderCandidates.mockResolvedValue([
        candidate(NOW.minus({ hours: 1 }), NOW.minus({ days: 3 }), 'started'),
        candidate(NOW.plus({ hours: 30 }), NOW.minus({ days: 3 }), 'later'),
      ]);

      await sut.sendDueReminders(NOW);

      expect(mocks.mailgunGateway.sendTemplate).not.toHaveBeenCalled();
    });

    it('skips bookings made inside the reminder window', async () => {
      mocks.classRepository.getReminderCandidates.mockResolvedValue([
        candidate(NOW.plus({ hours: 20 }), NOW.minus({ hours: 1 }), 'recent'),
      ]);

      await sut.sendDueReminders(NOW);

      expect(mocks.mailgunGateway.sendTemplate).not.toHaveBeenCalled();
    });

    it('keeps going when one reminder fails', async () => {
      mocks.classRepository.getReminderCandidates.mockResolvedValue([
        candidate(NOW.plus({ hours: 20 }), NOW.minus({ days: 3 }), 'fails'),
        candidate(NOW.plus({ hours: 21 }), NOW.minus({ days: 3 }), 'sends'),
      ]);
      mocks.mailgunGateway.sendTemplate.mockRejectedValueOnce(new Error('mailgun down'));

      await sut.sendDueReminders(NOW);

      expect(mocks.classRepository.updateBooking).not.toHaveBeenCalledWith(
        'fails',
        expect.anything(),
      );
      expect(mocks.classRepository.updateBooking).toHaveBeenCalledWith('sends', {
        reminderSentDate: NOW,
      });
    });
  });
});
