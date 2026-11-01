import { factory } from '$test/factory';
import { newTestService, type ServiceMocks } from '$test/utils';
import { SPACE_ZONE } from '$lib/space';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClassService } from './class.service';

describe(ClassService.name, () => {
  let sut: ClassService;
  let mocks: ServiceMocks;

  beforeEach(() => {
    ({ sut, mocks } = newTestService(ClassService));
    mocks.googleCalendarRepository.isConfigured.mockReturnValue(false);
  });

  describe('getCalendarLinkFor', () => {
    it('returns null when the Google service account is not configured', async () => {
      expect(await sut.getCalendarLinkFor('teacher@test.com')).toBeNull();
    });

    it('returns null for someone who is not a staff user', async () => {
      mocks.googleCalendarRepository.isConfigured.mockReturnValue(true);
      mocks.userRepository.getByEmail.mockResolvedValue(undefined as never);

      expect(await sut.getCalendarLinkFor('stranger@test.com')).toBeNull();
    });

    it('links the calendar the teacher already has', async () => {
      mocks.googleCalendarRepository.isConfigured.mockReturnValue(true);
      mocks.userRepository.getByEmail.mockResolvedValue(
        factory.user({ email: 'teacher@test.com', googleCalendarId: 'cal-1' }),
      );
      mocks.googleCalendarRepository.buildAddCalendarUrl.mockReturnValue('https://cal/cal-1');

      expect(await sut.getCalendarLinkFor('teacher@test.com')).toBe('https://cal/cal-1');
      expect(mocks.googleCalendarRepository.createCalendar).not.toHaveBeenCalled();
    });
  });

  describe('calendar sync', () => {
    const TEACHER = 'teacher@test.com';
    const instance = factory.classInstance({
      id: 'inst-1',
      date: '2099-06-15',
      startTime: '14:00',
      durationMinutes: 90,
      seats: 8,
    });
    const catalog = factory.classCatalog({ name: 'Welding' });
    const dto = {
      classId: instance.classId,
      teacherEmail: TEACHER,
      date: instance.date,
      startTime: instance.startTime,
      durationMinutes: instance.durationMinutes,
      seats: instance.seats,
    };

    function stubInstance(googleCalendarId: string | null, googleEventId: string | null = null) {
      return {
        ...instance,
        googleEventId,
        catalog,
        teacher: factory.user({ email: TEACHER, googleCalendarId }),
      };
    }

    beforeEach(() => {
      mocks.googleCalendarRepository.isConfigured.mockReturnValue(true);
      mocks.classRepository.createInstance.mockResolvedValue(instance);
      mocks.classRepository.getConfirmedBookingsForInstance.mockResolvedValue([
        factory.classBookingWithPayment({ customerName: 'Ada', customerPhone: '555', quantity: 2 }),
      ]);
      mocks.classRepository.setGoogleEventId.mockResolvedValue();
      mocks.googleCalendarRepository.createEvent.mockResolvedValue('event-1');
    });

    it('adds an event for a booked class to the teacher calendar', async () => {
      mocks.classRepository.getInstanceById.mockResolvedValue(stubInstance('cal-1'));

      await sut.createInstance(dto);

      await vi.waitFor(() =>
        expect(mocks.classRepository.setGoogleEventId).toHaveBeenCalledWith('inst-1', 'event-1'),
      );
      expect(mocks.googleCalendarRepository.createEvent).toHaveBeenCalledWith('cal-1', {
        summary: 'Welding (2 booked)',
        description: [
          'Class: Welding',
          'Number of attendees: 2/8',
          '',
          'Attendees:',
          '- Ada (x2) (555)',
        ].join('\n'),
        startDateTime: '2099-06-15T14:00:00-05:00',
        endDateTime: '2099-06-15T15:30:00-05:00',
        timeZone: SPACE_ZONE,
      });
    });

    it('creates the teacher calendar on first sync without duplicating the event', async () => {
      mocks.classRepository.getInstanceById
        .mockResolvedValueOnce(stubInstance(null))
        .mockResolvedValue(stubInstance('cal-new'));
      mocks.googleCalendarRepository.createCalendar.mockResolvedValue('cal-new');
      mocks.userRepository.setGoogleCalendarId.mockResolvedValue();
      mocks.classRepository.getScheduledInstanceIdsForTeacher.mockResolvedValue(['inst-1']);

      await sut.createInstance(dto);

      await vi.waitFor(() =>
        expect(mocks.classRepository.setGoogleEventId).toHaveBeenCalledWith('inst-1', 'event-1'),
      );
      expect(mocks.userRepository.setGoogleCalendarId).toHaveBeenCalledWith(TEACHER, 'cal-new');
      expect(mocks.googleCalendarRepository.createEvent).toHaveBeenCalledOnce();
    });

    it('removes the event once the class has no bookings', async () => {
      mocks.classRepository.getInstanceById.mockResolvedValue(stubInstance('cal-1', 'event-1'));
      mocks.classRepository.getConfirmedBookingsForInstance.mockResolvedValue([]);
      mocks.googleCalendarRepository.deleteEvent.mockResolvedValue();

      await sut.createInstance(dto);

      await vi.waitFor(() =>
        expect(mocks.classRepository.setGoogleEventId).toHaveBeenCalledWith('inst-1', null),
      );
      expect(mocks.googleCalendarRepository.deleteEvent).toHaveBeenCalledWith('cal-1', 'event-1');
    });
  });
});
