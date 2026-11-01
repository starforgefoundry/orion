import type {
  ClassBooking,
  ClassCatalog,
  ClassInstance,
  Payment,
  User,
} from '$lib/server/db/schema';
import { UserError } from '$lib/errors';
import { PaymentDeclinedError } from '$lib/server/gateways/payment.gateway';
import { SPACE_ZONE } from '$lib/space';
import { PAYMENT_STATUS } from '$lib/utils/billing';
import { factory } from '$test/factory';
import { newTestService, stubSettings, type ServiceMocks } from '$test/utils';
import { DateTime } from 'luxon';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClassService } from './class.service';

function paidPayment(total: number) {
  return factory.payment({ id: 'payment-1', status: PAYMENT_STATUS.PAID, total });
}

function instanceDetail(
  overrides: Partial<ClassInstance> = {},
  catalog: ClassCatalog | null = factory.classCatalog(),
  teacher: User | null = null,
) {
  return { ...factory.classInstance(overrides), teacher, catalog };
}

function bookingWithPayment(overrides: Partial<ClassBooking> = {}, payment: Payment | null = null) {
  return { ...factory.classBooking(overrides), payment };
}

function bookingDetail(
  overrides: Partial<ClassBooking> = {},
  payment: Payment | null = null,
  instance: ClassInstance | null = factory.classInstance(),
  catalog: ClassCatalog | null = factory.classCatalog(),
) {
  return { ...bookingWithPayment(overrides, payment), instance, catalog };
}

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

  describe('getCatalogById', () => {
    it('should return catalog by id', async () => {
      const catalog = factory.classCatalog({ id: 'cat-1', name: 'Welding Class' });
      mocks.classRepository.getCatalogById.mockResolvedValue(catalog);

      const result = await sut.getCatalogById('cat-1');

      expect(mocks.classRepository.getCatalogById).toHaveBeenCalledWith('cat-1');
      expect(result).toEqual(catalog);
    });
  });

  describe('getAllCatalogs', () => {
    it('should return all catalogs', async () => {
      mocks.classRepository.getAllCatalogs.mockResolvedValue([
        factory.classCatalog(),
        factory.classCatalog(),
      ]);

      const result = await sut.getAllCatalogs();

      expect(result).toHaveLength(2);
    });
  });

  describe('getActiveCatalogsWithInstances', () => {
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
      mocks.classRepository.getAllCatalogs.mockResolvedValue([factory.classCatalog()]);
      mocks.classRepository.getScheduledInstances.mockResolvedValue([
        { ...factory.classInstance({ date: '2000-01-01' }), teacher: null },
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
      const payment = paidPayment(5000);
      mocks.classRepository.getInstanceById.mockResolvedValue(
        instanceDetail({ id: 'inst-1', date: '2099-06-15' }),
      );
      mocks.classRepository.getConfirmedBookingsForInstance.mockResolvedValue([
        bookingWithPayment({ id: 'book-1' }, payment),
        bookingWithPayment({ id: 'book-2' }, null),
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
        instanceDetail({ id: 'inst-2', recurrenceGroupId: 'group-1', date: '2099-06-15' }),
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
        instanceDetail({ id: 'inst-1', date: '2099-06-15' }),
      );
      mocks.classRepository.getConfirmedBookingsForInstance.mockResolvedValue([
        bookingWithPayment({ id: 'book-1' }, paidPayment(5000)),
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
        instanceDetail({ id: 'a' }, null),
        instanceDetail({ id: 'b' }, null),
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
      const instance = instanceDetail({ id: 'inst-1' }, null);
      const bookings = [bookingWithPayment(), bookingWithPayment()];
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

  describe('getStaffUsers', () => {
    it('should delegate to repository', async () => {
      const users = [factory.user({ email: 'a@test.com' })];
      mocks.userRepository.getAll.mockResolvedValue(users);

      const result = await sut.getStaffUsers();

      expect(result).toEqual(users);
    });
  });

  describe('bookClass', () => {
    const dto = {
      instanceId: 'inst-1',
      customerName: 'Jane Doe',
      customerEmail: 'jane@test.com',
      customerPhone: '555-1234',
      quantity: 1,
      sourceId: 'sq-nonce-123',
    };
    const catalog = factory.classCatalog({ name: 'Welding Class', price: 5000 });
    const instance = instanceDetail(
      { id: 'inst-1', date: '2099-12-01', startTime: '10:00', seats: 10 },
      catalog,
    );
    const authorized = factory.payment({
      id: 'payment-1',
      status: PAYMENT_STATUS.PENDING,
      total: 5000,
    });
    const booking = factory.classBooking({
      id: 'book-1',
      instanceId: 'inst-1',
      bookingToken: 'tok-abc',
      status: 'confirmed',
    });
    const member = factory.member({ name: 'Jane Doe', email: 'jane@test.com' });

    beforeEach(() => {
      mocks.classRepository.getInstanceById.mockResolvedValue(instance);
      mocks.classRepository.getConfirmedBookingCount.mockResolvedValue(0);
      stubSettings(mocks.settingsRepository, { classSettings: { discordWebhookUrl: '' } });
      mocks.discordRepository.notify.mockResolvedValue(undefined);
      mocks.paymentGateway.authorize.mockResolvedValue(authorized);
      mocks.paymentGateway.capture.mockResolvedValue(paidPayment(5000));
      mocks.memberRepository.customerColumns.mockImplementation(async (customer) => ({
        memberId: member.id,
        customerName: customer.customerName,
        customerEmail: customer.customerEmail,
        customerPhone: customer.customerPhone,
      }));
      mocks.classRepository.createBooking.mockResolvedValue(booking);
      mocks.mailgunGateway.sendTemplate.mockResolvedValue(undefined as never);
      mocks.classRepository.getBookingById.mockResolvedValue(
        bookingDetail(
          { ...booking, customerName: dto.customerName, customerEmail: dto.customerEmail },
          paidPayment(5000),
          factory.classInstance({ date: '2099-12-01', startTime: '10:00', durationMinutes: 60 }),
          factory.classCatalog({ name: 'Welding Class' }),
        ),
      );
    });

    it('should process a booking successfully', async () => {
      const result = await sut.bookClass(dto);

      expect(result).toEqual(booking);
      expect(mocks.paymentGateway.authorize).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'class_booking',
          customer: { name: 'Jane Doe', email: 'jane@test.com' },
          bill: expect.objectContaining({
            total: 5000,
            lineItems: [{ name: 'Welding Class - Dec 1, 2099', quantity: 1, unitAmount: 5000 }],
          }),
        }),
        'sq-nonce-123',
      );
      expect(mocks.memberRepository.customerColumns).toHaveBeenCalledWith(dto);
      expect(mocks.classRepository.createBooking).toHaveBeenCalledWith({
        instanceId: 'inst-1',
        memberId: member.id,
        customerName: 'Jane Doe',
        customerEmail: 'jane@test.com',
        customerPhone: '555-1234',
        paymentId: 'payment-1',
        status: 'confirmed',
        quantity: 1,
      });
      expect(mocks.paymentGateway.capture).toHaveBeenCalledWith(authorized);
    });

    it('should throw when instance not found', async () => {
      mocks.classRepository.getInstanceById.mockResolvedValue(null);

      await expect(sut.bookClass(dto)).rejects.toThrow('Class not found');
    });

    it('should throw when instance is canceled', async () => {
      mocks.classRepository.getInstanceById.mockResolvedValue({
        ...instance,
        status: 'canceled',
      });

      await expect(sut.bookClass(dto)).rejects.toThrow('This class has been canceled');
    });

    it('should throw when class date is in the past', async () => {
      mocks.classRepository.getInstanceById.mockResolvedValue({ ...instance, date: '2000-01-01' });

      await expect(sut.bookClass(dto)).rejects.toThrow('Cannot book a class in the past');
    });

    it('should throw when class is fully booked', async () => {
      mocks.classRepository.getConfirmedBookingCount.mockResolvedValue(10);

      await expect(sut.bookClass(dto)).rejects.toThrow('This class is fully booked');
      await expect(sut.bookClass(dto)).rejects.toBeInstanceOf(UserError);
    });

    it('should throw when the card is declined', async () => {
      mocks.paymentGateway.authorize.mockRejectedValue(new PaymentDeclinedError());

      await expect(sut.bookClass(dto)).rejects.toThrow('Payment failed');
      expect(mocks.classRepository.createBooking).not.toHaveBeenCalled();
    });

    it('should cancel the booking when the capture fails', async () => {
      mocks.paymentGateway.capture.mockRejectedValue(new PaymentDeclinedError());
      mocks.classRepository.updateBooking.mockResolvedValue(factory.classBooking());

      await expect(sut.bookClass(dto)).rejects.toThrow('Payment failed');
      expect(mocks.classRepository.updateBooking).toHaveBeenCalledWith('book-1', {
        status: 'canceled',
      });
    });

    it('should void and cancel if overbooking detected after insert', async () => {
      mocks.classRepository.getConfirmedBookingCount
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(11);
      mocks.classRepository.updateBooking.mockResolvedValue(factory.classBooking());
      mocks.paymentGateway.void.mockResolvedValue(
        factory.payment({ ...authorized, status: PAYMENT_STATUS.CANCELED }),
      );

      await expect(sut.bookClass(dto)).rejects.toThrow('This class is fully booked');
      expect(mocks.classRepository.updateBooking).toHaveBeenCalledWith('book-1', {
        status: 'canceled',
      });
      expect(mocks.paymentGateway.void).toHaveBeenCalledWith(authorized);
      expect(mocks.paymentGateway.capture).not.toHaveBeenCalled();
    });
  });

  describe('cancelBooking', () => {
    it('should cancel a booking and refund payment', async () => {
      const payment = paidPayment(5000);
      mocks.classRepository.getBookingByToken.mockResolvedValue(
        bookingDetail({ id: 'book-1', status: 'confirmed' }, payment),
      );
      mocks.paymentGateway.refund.mockResolvedValue(true);
      mocks.classRepository.updateBooking.mockResolvedValue(factory.classBooking());

      const result = await sut.cancelBooking({ bookingToken: 'tok-abc' });

      expect(result).toEqual({ success: true });
      expect(mocks.paymentGateway.refund).toHaveBeenCalledWith(payment);
      expect(mocks.classRepository.updateBooking).toHaveBeenCalledWith('book-1', {
        status: 'canceled',
      });
    });

    it('should cancel without refund when no payment exists', async () => {
      mocks.classRepository.getBookingByToken.mockResolvedValue(
        bookingDetail({ id: 'book-1', status: 'confirmed' }, null),
      );
      mocks.classRepository.updateBooking.mockResolvedValue(factory.classBooking());

      await sut.cancelBooking({ bookingToken: 'tok-abc' });

      expect(mocks.paymentGateway.refund).not.toHaveBeenCalled();
      expect(mocks.classRepository.updateBooking).toHaveBeenCalledWith('book-1', {
        status: 'canceled',
      });
    });

    it('rejects customer cancellation once the class has started', async () => {
      const instance = factory.classInstance({ date: '2026-10-16', startTime: '10:00' });
      const justAfterStart = DateTime.fromISO('2026-10-16T10:01', { zone: SPACE_ZONE });
      mocks.classRepository.getBookingByToken.mockResolvedValue(
        bookingDetail({ status: 'confirmed' }, paidPayment(5000), instance),
      );

      await expect(sut.cancelBooking({ bookingToken: 'tok-abc' }, justAfterStart)).rejects.toThrow(
        'already started',
      );
      expect(mocks.paymentGateway.refund).not.toHaveBeenCalled();
      expect(mocks.classRepository.updateBooking).not.toHaveBeenCalled();
    });

    it('should throw when booking not found', async () => {
      mocks.classRepository.getBookingByToken.mockResolvedValue(null);

      await expect(sut.cancelBooking({ bookingToken: 'bad-token' })).rejects.toThrow(
        'Booking not found',
      );
    });

    it('should throw when booking already canceled', async () => {
      mocks.classRepository.getBookingByToken.mockResolvedValue(
        bookingDetail({ id: 'book-1', status: 'canceled' }),
      );

      await expect(sut.cancelBooking({ bookingToken: 'tok-abc' })).rejects.toThrow(
        'Booking is already canceled',
      );
    });
  });

  describe('cancelBookingStaff', () => {
    it('should cancel a booking by id and refund', async () => {
      const payment = paidPayment(3000);
      mocks.classRepository.getBookingById.mockResolvedValue(
        bookingDetail({ id: 'book-1', status: 'confirmed' }, payment),
      );
      mocks.paymentGateway.refund.mockResolvedValue(true);
      mocks.classRepository.updateBooking.mockResolvedValue(factory.classBooking());

      const result = await sut.cancelBookingStaff({ bookingId: 'book-1' });

      expect(result).toEqual({ success: true });
      expect(mocks.paymentGateway.refund).toHaveBeenCalledWith(payment);
    });

    it('lets staff cancel a class that already started', async () => {
      mocks.classRepository.getBookingById.mockResolvedValue(
        bookingDetail(
          { id: 'book-1', status: 'confirmed' },
          null,
          factory.classInstance({ date: '2000-01-01' }),
        ),
      );
      mocks.classRepository.updateBooking.mockResolvedValue(factory.classBooking());

      await expect(sut.cancelBookingStaff({ bookingId: 'book-1' })).resolves.toEqual({
        success: true,
      });
      expect(mocks.classRepository.updateBooking).toHaveBeenCalledWith('book-1', {
        status: 'canceled',
      });
    });

    it('should throw when booking not found', async () => {
      mocks.classRepository.getBookingById.mockResolvedValue(null);

      await expect(sut.cancelBookingStaff({ bookingId: 'bad-id' })).rejects.toThrow(
        'Booking not found',
      );
    });

    it('should throw when booking already canceled', async () => {
      mocks.classRepository.getBookingById.mockResolvedValue(
        bookingDetail({ id: 'book-1', status: 'canceled' }),
      );

      await expect(sut.cancelBookingStaff({ bookingId: 'book-1' })).rejects.toThrow(
        'Booking is already canceled',
      );
    });
  });

  describe('rescheduleBooking', () => {
    const CLASS_ID = 'class-1';
    const SOURCE_ID = 'inst-source';
    const TARGET_ID = 'inst-target';
    const dto = { bookingId: 'book-1', targetInstanceId: TARGET_ID };

    function stubBooking(overrides: Partial<ClassBooking> = {}, payment: Payment | null = null) {
      mocks.classRepository.getBookingById.mockResolvedValue(
        bookingDetail(
          { id: 'book-1', instanceId: SOURCE_ID, quantity: 2, ...overrides },
          payment,
          factory.classInstance({ id: SOURCE_ID, classId: CLASS_ID }),
        ),
      );
    }

    function stubTarget(overrides: Partial<ClassInstance> = {}) {
      mocks.classRepository.getInstanceById.mockResolvedValue(
        instanceDetail({ id: TARGET_ID, classId: CLASS_ID, seats: 10, ...overrides }),
      );
    }

    function stubCounts(before: number, after: number) {
      mocks.classRepository.getConfirmedBookingsForInstance.mockResolvedValue([
        bookingWithPayment({
          instanceId: TARGET_ID,
          customerEmail: 'other@example.com',
          quantity: before,
        }),
      ]);
      mocks.classRepository.getConfirmedBookingCount.mockResolvedValue(after);
    }

    beforeEach(() => {
      mocks.classRepository.getConfirmedBookingsForInstance.mockResolvedValue([]);
    });

    it('should move the booking without touching its payment', async () => {
      stubBooking({}, paidPayment(5000));
      stubTarget();
      stubCounts(8, 10);
      const moved = factory.classBooking({ id: 'book-1', instanceId: TARGET_ID });
      mocks.classRepository.updateBooking.mockResolvedValue(moved);

      const result = await sut.rescheduleBooking(dto);

      expect(result).toEqual({ booking: moved, previousInstanceId: SOURCE_ID });
      expect(mocks.classRepository.updateBooking).toHaveBeenCalledExactlyOnceWith('book-1', {
        instanceId: TARGET_ID,
        reminderSentDate: null,
      });
      expect(mocks.paymentGateway.authorize).not.toHaveBeenCalled();
      expect(mocks.paymentGateway.refund).not.toHaveBeenCalled();
    });

    it('should throw when booking not found', async () => {
      mocks.classRepository.getBookingById.mockResolvedValue(null);

      await expect(sut.rescheduleBooking(dto)).rejects.toThrow('Booking not found');
    });

    it('should throw when booking is canceled', async () => {
      stubBooking({ status: 'canceled' });

      await expect(sut.rescheduleBooking(dto)).rejects.toThrow('Booking is already canceled');
    });

    it('should throw when target is the current session', async () => {
      stubBooking({ instanceId: TARGET_ID });

      await expect(sut.rescheduleBooking(dto)).rejects.toThrow(
        'Booking is already in this class session',
      );
    });

    it('should throw when target session not found', async () => {
      stubBooking();
      mocks.classRepository.getInstanceById.mockResolvedValue(null);

      await expect(sut.rescheduleBooking(dto)).rejects.toThrow('Class not found');
    });

    it('should throw when target belongs to another class', async () => {
      stubBooking();
      stubTarget({ classId: 'class-2' });

      await expect(sut.rescheduleBooking(dto)).rejects.toThrow(
        'Bookings can only move to a session of the same class',
      );
    });

    it('should throw when target session is canceled', async () => {
      stubBooking();
      stubTarget({ status: 'canceled' });

      await expect(sut.rescheduleBooking(dto)).rejects.toThrow('This class has been canceled');
    });

    it('should throw when target session is in the past', async () => {
      stubBooking();
      stubTarget({ date: DateTime.now().minus({ days: 1 }).toISODate()! });

      await expect(sut.rescheduleBooking(dto)).rejects.toThrow('Cannot book a class in the past');
    });

    it('should throw when customer is already booked in the target session', async () => {
      stubBooking({ customerEmail: 'jane@example.com' });
      stubTarget();
      mocks.classRepository.getConfirmedBookingsForInstance.mockResolvedValue([
        bookingWithPayment({ instanceId: TARGET_ID, customerEmail: 'Jane@Example.com' }),
      ]);

      await expect(sut.rescheduleBooking(dto)).rejects.toThrow(
        'Customer is already booked in that session',
      );
    });

    it('should throw when target session lacks capacity', async () => {
      stubBooking();
      stubTarget();
      stubCounts(9, 9);

      await expect(sut.rescheduleBooking(dto)).rejects.toThrow('Only 1 spot remaining');
      expect(mocks.classRepository.updateBooking).not.toHaveBeenCalled();
    });

    it('should move the booking back when a concurrent booking overfills the target', async () => {
      const reminderSentDate = DateTime.now();
      stubBooking({ reminderSentDate });
      stubTarget();
      stubCounts(8, 11);
      mocks.classRepository.updateBooking.mockResolvedValue(factory.classBooking());
      await expect(sut.rescheduleBooking(dto)).rejects.toThrow('This class is fully booked');
      expect(mocks.classRepository.updateBooking).toHaveBeenLastCalledWith('book-1', {
        instanceId: SOURCE_ID,
        reminderSentDate,
      });
      expect(mocks.mailgunGateway.sendTemplate).not.toHaveBeenCalled();
    });

    describe('confirmation email', () => {
      beforeEach(() => {
        mocks.classRepository.getBookingById.mockResolvedValue(
          bookingDetail(
            {
              id: 'book-1',
              instanceId: SOURCE_ID,
              customerName: 'Jane Doe',
              customerEmail: 'jane@test.com',
              bookingToken: 'tok-abc',
              passToken: 'pass-abc',
              quantity: 1,
            },
            paidPayment(5000),
            factory.classInstance({
              id: SOURCE_ID,
              classId: CLASS_ID,
              date: '2099-12-01',
              startTime: '10:00',
              durationMinutes: 60,
            }),
            factory.classCatalog({ name: 'Welding Class' }),
          ),
        );
        stubTarget();
        stubCounts(0, 2);
        mocks.classRepository.updateBooking.mockResolvedValue(factory.classBooking());
      });

      it('should resend the confirmation for the moved booking', async () => {
        mocks.mailgunGateway.sendTemplate.mockResolvedValue(undefined as never);

        await sut.rescheduleBooking(dto);

        await vi.waitFor(() =>
          expect(mocks.mailgunGateway.sendTemplate).toHaveBeenCalledExactlyOnceWith(
            'jane@test.com',
            {
              from: 'Starforge Classes <classes@starforgefoundry.com>',
              replyTo: 'classes@starforgefoundry.com',
            },
            'class_booking',
            expect.objectContaining({
              customerName: 'Jane Doe',
              className: 'Welding Class',
              quantity: '1',
              amountPaid: '50.00',
              bookingUrl: 'https://orion.example.com/classes/booking/tok-abc',
              passUrl: 'https://orion.example.com/pass/pass-abc',
              passQrImageUrl: 'https://orion.example.com/api/pass/pass-abc/qr',
            }),
          ),
        );
      });

      it('should keep the move when the email fails', async () => {
        mocks.mailgunGateway.sendTemplate.mockRejectedValue(new Error('Mailgun down'));

        await expect(sut.rescheduleBooking(dto)).resolves.toMatchObject({
          previousInstanceId: SOURCE_ID,
        });

        await vi.waitFor(() => expect(mocks.mailgunGateway.sendTemplate).toHaveBeenCalled());
        expect(mocks.classRepository.updateBooking).toHaveBeenCalledExactlyOnceWith('book-1', {
          instanceId: TARGET_ID,
          reminderSentDate: null,
        });
      });
    });
  });

  describe('sendDueReminders', () => {
    const NOW = DateTime.fromISO('2026-10-12T09:00', { zone: SPACE_ZONE });
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
        bookingWithPayment({ customerName: 'Ada', customerPhone: '555', quantity: 2 }),
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
