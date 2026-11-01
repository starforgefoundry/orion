import { SPACE_ZONE, spaceDate } from '$lib/utils/space';
import { factory } from '$test/factory';
import { newTestService, type ServiceMocks } from '$test/utils';
import { DateTime } from 'luxon';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClassService } from './class.service';

const PAYMENT_ID = 'payment-1';
const NOW = DateTime.fromISO('2026-10-12T09:00', { zone: SPACE_ZONE });

describe(ClassService.name, () => {
  let sut: ClassService;
  let mocks: ServiceMocks;

  beforeEach(() => {
    ({ sut, mocks } = newTestService(ClassService));
    mocks.googleCalendarRepository.isConfigured.mockReturnValue(false);
  });

  describe('upsertCatalog', () => {
    it('should create a catalog entry', async () => {
      const dto = { name: 'Welding Class', description: 'Intro class', price: 5000 };
      const expected = factory.classCatalog(dto);
      mocks.classRepository.createCatalog.mockResolvedValue(expected);

      const result = await sut.upsertCatalog(dto);

      expect(mocks.classRepository.createCatalog).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expected);
    });

    it('should update a catalog by id', async () => {
      const dto = { id: 'cat-1', name: 'Pottery 201', description: 'Advanced', price: 7500 };
      const expected = factory.classCatalog(dto);
      mocks.classRepository.updateCatalog.mockResolvedValue(expected);

      const result = await sut.upsertCatalog(dto);

      expect(mocks.classRepository.updateCatalog).toHaveBeenCalledWith('cat-1', {
        name: 'Pottery 201',
        description: 'Advanced',
        price: 7500,
      });
      expect(result).toEqual(expected);
    });

    it('should upload the photo and store its link on the catalog', async () => {
      const photo = new File(['data'], 'photo.jpg');
      const created = factory.classCatalog({ id: 'cat-1' });
      mocks.classRepository.createCatalog.mockResolvedValue(created);
      mocks.classRepository.uploadClassPhoto.mockResolvedValue('https://s3/photo.jpg');
      mocks.classRepository.updateCatalog.mockResolvedValue(created);

      await sut.upsertCatalog({ name: 'Welding', description: 'Intro', price: 0, photo });

      expect(mocks.classRepository.uploadClassPhoto).toHaveBeenCalledWith('cat-1', photo);
      expect(mocks.classRepository.updateCatalog).toHaveBeenCalledWith('cat-1', {
        photoUrl: 'https://s3/photo.jpg',
      });
    });
  });

  describe('getActiveCatalogsWithInstances', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(NOW.toJSDate());
    });

    it('should return active catalogs with future instances and booking counts', async () => {
      const catalog = factory.classCatalog({ name: 'Pottery' });
      const other = factory.classCatalog({ name: 'Welding' });
      mocks.classRepository.getAllCatalogs.mockResolvedValue([catalog, other]);
      mocks.classRepository.getScheduledInstances.mockResolvedValue([
        {
          ...factory.classInstance({ id: 'a', classId: catalog.id, date: '2099-12-01' }),
          teacher: null,
        },
        {
          ...factory.classInstance({ id: 'b', classId: catalog.id, date: '2099-12-08' }),
          teacher: null,
        },
        {
          ...factory.classInstance({ id: 'c', classId: other.id, date: '2099-12-08' }),
          teacher: null,
        },
      ]);
      mocks.classRepository.getConfirmedSeatCounts.mockResolvedValue(new Map([['a', 3]]));

      const result = await sut.getActiveCatalogsWithInstances();

      expect(mocks.classRepository.getConfirmedSeatCounts).toHaveBeenCalledOnce();
      expect(result).toHaveLength(2);
      expect(result[0].instances.map((i) => [i.id, i.confirmedCount])).toEqual([
        ['a', 3],
        ['b', 0],
      ]);
      expect(result[1].instances.map((i) => i.id)).toEqual(['c']);
    });

    it('should exclude catalogs with no future instances', async () => {
      const yesterday = spaceDate(NOW.minus({ days: 1 }));
      mocks.classRepository.getAllCatalogs.mockResolvedValue([factory.classCatalog()]);
      mocks.classRepository.getScheduledInstances.mockResolvedValue([
        { ...factory.classInstance({ date: yesterday }), teacher: null },
      ]);
      mocks.classRepository.getConfirmedSeatCounts.mockResolvedValue(new Map());

      const result = await sut.getActiveCatalogsWithInstances();

      expect(result).toHaveLength(0);
    });
  });

  describe('generateInstances', () => {
    const MONDAY = 1;
    const SUNDAY = 0;

    it('should generate weekly instances between start and end dates', async () => {
      mocks.classRepository.createInstances.mockResolvedValue([]);

      await sut.generateInstances({
        classId: 'cat-1',
        teacherEmail: 'teacher@test.com',
        dayOfWeek: MONDAY,
        startTime: '10:00',
        durationMinutes: 60,
        seats: 10,
        startDate: '2099-01-05',
        endDate: '2099-01-19',
      });

      expect(mocks.classRepository.createInstances).toHaveBeenCalledTimes(1);
      const createdInstances = mocks.classRepository.createInstances.mock.calls[0][0];
      expect(createdInstances).toHaveLength(3);
      expect(createdInstances[0].date).toBe('2099-01-05');
      expect(createdInstances[1].date).toBe('2099-01-12');
      expect(createdInstances[2].date).toBe('2099-01-19');
      expect(createdInstances[0].recurrenceGroupId).toBe(createdInstances[1].recurrenceGroupId);
    });

    it('should handle no matching days in range', async () => {
      mocks.classRepository.createInstances.mockResolvedValue([]);

      await sut.generateInstances({
        classId: 'cat-1',
        teacherEmail: 'teacher@test.com',
        dayOfWeek: SUNDAY,
        startTime: '10:00',
        durationMinutes: 60,
        seats: 10,
        startDate: '2099-01-06',
        endDate: '2099-01-10',
      });

      const createdInstances = mocks.classRepository.createInstances.mock.calls[0][0];
      expect(createdInstances).toHaveLength(0);
    });
  });

  describe('createInstance', () => {
    it('should create a single instance', async () => {
      const dto = {
        classId: 'cat-1',
        teacherEmail: 'teacher@test.com',
        date: '2099-06-15',
        startTime: '14:00',
        durationMinutes: 90,
        seats: 8,
      };
      const expected = factory.classInstance({ ...dto, status: 'scheduled' });
      mocks.classRepository.createInstance.mockResolvedValue(expected);

      const result = await sut.createInstance(dto);

      expect(mocks.classRepository.createInstance).toHaveBeenCalledWith({
        ...dto,
        status: 'scheduled',
      });
      expect(result).toEqual(expected);
    });
  });

  describe('cancelInstance', () => {
    it('should cancel a single instance and refund bookings', async () => {
      const payment = factory.paidPayment({ id: PAYMENT_ID, total: 5000 });
      mocks.classRepository.getInstanceById.mockResolvedValue(
        factory.classInstanceDetail({ id: 'inst-1', date: '2099-06-15' }),
      );
      mocks.classRepository.getConfirmedBookingsForInstance.mockResolvedValue([
        factory.classBookingWithPayment({ id: 'book-1' }, payment),
        factory.classBookingWithPayment({ id: 'book-2' }, null),
      ]);
      mocks.paymentGateway.refund.mockResolvedValue(true);
      mocks.classRepository.updateBooking.mockResolvedValue(factory.classBooking());
      mocks.classRepository.updateInstance.mockResolvedValue(factory.classInstance());

      const result = await sut.cancelInstance({ instanceId: 'inst-1', mode: 'single' });

      expect(result.canceledCount).toBe(1);
      expect(mocks.paymentGateway.refund).toHaveBeenCalledTimes(1);
      expect(mocks.paymentGateway.refund).toHaveBeenCalledWith(payment);
      expect(mocks.classRepository.updateBooking).toHaveBeenCalledTimes(2);
      expect(mocks.classRepository.updateInstance).toHaveBeenCalledWith('inst-1', {
        status: 'canceled',
      });
    });

    it('should cancel this and future instances in a recurrence group', async () => {
      mocks.classRepository.getInstanceById.mockResolvedValue(
        factory.classInstanceDetail({
          id: 'inst-2',
          recurrenceGroupId: 'group-1',
          date: '2099-06-15',
        }),
      );
      mocks.classRepository.getScheduledInstancesByRecurrenceGroup.mockResolvedValue([
        factory.classInstance({ id: 'inst-2', date: '2099-06-15' }),
        factory.classInstance({ id: 'inst-3', date: '2099-06-22' }),
      ]);
      mocks.classRepository.getConfirmedBookingsForInstance.mockResolvedValue([]);
      mocks.classRepository.updateInstance.mockResolvedValue(factory.classInstance());

      const result = await sut.cancelInstance({ instanceId: 'inst-2', mode: 'this_and_future' });

      expect(result.canceledCount).toBe(2);
      expect(mocks.classRepository.updateInstance).toHaveBeenCalledTimes(2);
    });

    it('should throw when instance not found', async () => {
      mocks.classRepository.getInstanceById.mockResolvedValue(null);

      await expect(sut.cancelInstance({ instanceId: 'bad-id', mode: 'single' })).rejects.toThrow(
        'Instance not found',
      );
    });

    it('should handle refund failure gracefully and still cancel', async () => {
      mocks.classRepository.getInstanceById.mockResolvedValue(
        factory.classInstanceDetail({ id: 'inst-1', date: '2099-06-15' }),
      );
      mocks.classRepository.getConfirmedBookingsForInstance.mockResolvedValue([
        factory.classBookingWithPayment(
          { id: 'book-1' },
          factory.paidPayment({ id: PAYMENT_ID, total: 5000 }),
        ),
      ]);
      mocks.paymentGateway.refund.mockRejectedValue(new Error('Square error'));
      mocks.classRepository.updateBooking.mockResolvedValue(factory.classBooking());
      mocks.classRepository.updateInstance.mockResolvedValue(factory.classInstance());

      const result = await sut.cancelInstance({ instanceId: 'inst-1', mode: 'single' });

      expect(result.canceledCount).toBe(1);
      expect(mocks.classRepository.updateBooking).toHaveBeenCalledWith('book-1', {
        status: 'canceled',
      });
      expect(mocks.classRepository.updateInstance).toHaveBeenCalledWith('inst-1', {
        status: 'canceled',
      });
    });
  });

  describe('getAllInstances', () => {
    it('should return instances with confirmed counts', async () => {
      mocks.classRepository.getAllInstances.mockResolvedValue([
        factory.classInstanceDetail({ id: 'a' }, null),
        factory.classInstanceDetail({ id: 'b' }, null),
      ]);
      mocks.classRepository.getConfirmedSeatCounts.mockResolvedValue(
        new Map([
          ['a', 2],
          ['b', 5],
        ]),
      );

      const result = await sut.getAllInstances();

      expect(result).toHaveLength(2);
      expect(result[0].confirmedCount).toBe(2);
      expect(result[1].confirmedCount).toBe(5);
    });
  });

  describe('getInstancesForCatalog', () => {
    it('leaves out the teacher email and calendar ids', async () => {
      const teacher = { name: 'Teacher', picture: 'pic.jpg' };
      mocks.classRepository.getScheduledInstances.mockResolvedValue([
        {
          ...factory.classInstance({
            id: 'a',
            teacherEmail: 'teacher@example.com',
            googleEventId: 'event-1',
          }),
          teacher,
        },
      ]);
      mocks.classRepository.getConfirmedSeatCounts.mockResolvedValue(new Map([['a', 4]]));

      const [instance] = await sut.getInstancesForCatalog('cat-1');

      expect(instance).toMatchObject({ id: 'a', teacher, confirmedCount: 4 });
      expect(instance).not.toHaveProperty('teacherEmail');
      expect(instance).not.toHaveProperty('googleEventId');
    });
  });

  describe('getInstanceDetail', () => {
    it('should return instance with bookings', async () => {
      const instance = factory.classInstanceDetail({ id: 'inst-1' }, null);
      const bookings = [factory.classBookingWithPayment(), factory.classBookingWithPayment()];
      mocks.classRepository.getInstanceById.mockResolvedValue(instance);
      mocks.classRepository.getBookingsForInstance.mockResolvedValue(bookings);

      const result = await sut.getInstanceDetail('inst-1');

      expect(result).toEqual({ ...instance, bookings });
    });

    it('should return null when instance not found', async () => {
      mocks.classRepository.getInstanceById.mockResolvedValue(null);

      const result = await sut.getInstanceDetail('bad-id');

      expect(result).toBeNull();
    });
  });
});
