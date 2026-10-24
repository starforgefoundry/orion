import type {
  ClassBooking,
  ClassCatalog,
  ClassInstance,
  Payment,
  User,
} from '$lib/server/db/schema';
import { PaymentDeclinedError } from '$lib/server/repositories/payment.repository';
import { PAYMENT_STATUS } from '$lib/utils/billing';
import { factory } from '$test/factory';
import { newTestService, stubSettings, type ServiceMocks } from '$test/utils';
import { beforeEach, describe, expect, it } from 'vitest';
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

  describe('createCatalog', () => {
    it('should create a catalog entry', async () => {
      const dto = { name: 'Welding Class', description: 'Intro class', price: 5000 };
      const expected = factory.classCatalog(dto);
      mocks.classRepository.createCatalog.mockResolvedValue(expected);

      const result = await sut.createCatalog(dto);

      expect(mocks.classRepository.createCatalog).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expected);
    });
  });

  describe('updateCatalog', () => {
    it('should update a catalog by id', async () => {
      const dto = { id: 'cat-1', name: 'Pottery 201', description: 'Advanced', price: 7500 };
      const expected = factory.classCatalog(dto);
      mocks.classRepository.updateCatalog.mockResolvedValue(expected);

      const result = await sut.updateCatalog(dto);

      expect(mocks.classRepository.updateCatalog).toHaveBeenCalledWith('cat-1', {
        name: 'Pottery 201',
        description: 'Advanced',
        price: 7500,
      });
      expect(result).toEqual(expected);
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
      mocks.classRepository.getAllCatalogs.mockResolvedValue([catalog]);
      mocks.classRepository.getInstancesForCatalog.mockResolvedValue([
        { ...factory.classInstance({ classId: catalog.id, date: '2099-12-01' }), teacher: null },
        { ...factory.classInstance({ classId: catalog.id, date: '2099-12-08' }), teacher: null },
      ]);
      mocks.classRepository.getConfirmedBookingCount.mockResolvedValue(3);

      const result = await sut.getActiveCatalogsWithInstances();

      expect(result).toHaveLength(1);
      expect(result[0].instances).toHaveLength(2);
      expect(result[0].instances[0].confirmedCount).toBe(3);
    });

    it('should exclude catalogs with no future instances', async () => {
      mocks.classRepository.getAllCatalogs.mockResolvedValue([factory.classCatalog()]);
      mocks.classRepository.getInstancesForCatalog.mockResolvedValue([
        { ...factory.classInstance({ date: '2000-01-01' }), teacher: null },
      ]);

      const result = await sut.getActiveCatalogsWithInstances();

      expect(result).toHaveLength(0);
    });
  });

  describe('uploadClassPhoto', () => {
    it('should upload photo and update catalog', async () => {
      const file = new File(['data'], 'photo.jpg');
      mocks.classRepository.uploadClassPhoto.mockResolvedValue('https://s3/photo.jpg');
      mocks.classRepository.updateCatalog.mockResolvedValue(factory.classCatalog());

      const result = await sut.uploadClassPhoto('cat-1', file);

      expect(mocks.classRepository.uploadClassPhoto).toHaveBeenCalledWith('cat-1', file);
      expect(mocks.classRepository.updateCatalog).toHaveBeenCalledWith('cat-1', {
        photoUrl: 'https://s3/photo.jpg',
      });
      expect(result).toBe('https://s3/photo.jpg');
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

  describe('updateInstance', () => {
    it('should update instance with only defined fields', async () => {
      mocks.classRepository.updateInstance.mockResolvedValue(factory.classInstance());

      await sut.updateInstance({ id: 'inst-1', seats: 12, teacherEmail: undefined });

      expect(mocks.classRepository.updateInstance).toHaveBeenCalledWith('inst-1', { seats: 12 });
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
      mocks.paymentRepository.refund.mockResolvedValue(true);
      mocks.classRepository.updateBooking.mockResolvedValue(factory.classBooking());
      mocks.classRepository.updateInstance.mockResolvedValue(factory.classInstance());

      const result = await sut.cancelInstance({ instanceId: 'inst-1', mode: 'single' });

      expect(result.canceledCount).toBe(1);
      expect(mocks.paymentRepository.refund).toHaveBeenCalledTimes(1);
      expect(mocks.paymentRepository.refund).toHaveBeenCalledWith(payment);
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
      mocks.paymentRepository.refund.mockRejectedValue(new Error('Square error'));
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
        instanceDetail({}, null),
        instanceDetail({}, null),
      ]);
      mocks.classRepository.getConfirmedBookingCount
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(5);

      const result = await sut.getAllInstances();

      expect(result).toHaveLength(2);
      expect(result[0].confirmedCount).toBe(2);
      expect(result[1].confirmedCount).toBe(5);
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
      mocks.classRepository.getStaffUsers.mockResolvedValue(users);

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

    beforeEach(() => {
      mocks.classRepository.getInstanceById.mockResolvedValue(instance);
      mocks.classRepository.getConfirmedBookingCount.mockResolvedValue(0);
      stubSettings(mocks.settingsRepository, { classSettings: { discordWebhookUrl: '' } });
      mocks.paymentRepository.authorize.mockResolvedValue(authorized);
      mocks.paymentRepository.capture.mockResolvedValue(paidPayment(5000));
      mocks.classRepository.createBooking.mockResolvedValue(booking);
      mocks.mailgunRepository.sendTemplate.mockResolvedValue(undefined as never);
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
      expect(mocks.paymentRepository.authorize).toHaveBeenCalledWith(
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
      expect(mocks.classRepository.createBooking).toHaveBeenCalledWith({
        instanceId: 'inst-1',
        customerName: 'Jane Doe',
        customerEmail: 'jane@test.com',
        customerPhone: '555-1234',
        paymentId: 'payment-1',
        status: 'confirmed',
        quantity: 1,
      });
      expect(mocks.paymentRepository.capture).toHaveBeenCalledWith(authorized);
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
    });

    it('should throw when the card is declined', async () => {
      mocks.paymentRepository.authorize.mockRejectedValue(new PaymentDeclinedError());

      await expect(sut.bookClass(dto)).rejects.toThrow('Payment failed');
      expect(mocks.classRepository.createBooking).not.toHaveBeenCalled();
    });

    it('should cancel the booking when the capture fails', async () => {
      mocks.paymentRepository.capture.mockRejectedValue(new Error('capture failed'));
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
      mocks.paymentRepository.void.mockResolvedValue(
        factory.payment({ ...authorized, status: PAYMENT_STATUS.CANCELED }),
      );

      await expect(sut.bookClass(dto)).rejects.toThrow('This class is fully booked');
      expect(mocks.classRepository.updateBooking).toHaveBeenCalledWith('book-1', {
        status: 'canceled',
      });
      expect(mocks.paymentRepository.void).toHaveBeenCalledWith(authorized);
      expect(mocks.paymentRepository.capture).not.toHaveBeenCalled();
    });
  });

  describe('cancelBooking', () => {
    it('should cancel a booking and refund payment', async () => {
      const payment = paidPayment(5000);
      mocks.classRepository.getBookingByToken.mockResolvedValue(
        bookingDetail({ id: 'book-1', status: 'confirmed' }, payment),
      );
      mocks.paymentRepository.refund.mockResolvedValue(true);
      mocks.classRepository.updateBooking.mockResolvedValue(factory.classBooking());

      const result = await sut.cancelBooking({ bookingToken: 'tok-abc' });

      expect(result).toEqual({ success: true });
      expect(mocks.paymentRepository.refund).toHaveBeenCalledWith(payment);
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

      expect(mocks.paymentRepository.refund).not.toHaveBeenCalled();
      expect(mocks.classRepository.updateBooking).toHaveBeenCalledWith('book-1', {
        status: 'canceled',
      });
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
      mocks.paymentRepository.refund.mockResolvedValue(true);
      mocks.classRepository.updateBooking.mockResolvedValue(factory.classBooking());

      const result = await sut.cancelBookingStaff({ bookingId: 'book-1' });

      expect(result).toEqual({ success: true });
      expect(mocks.paymentRepository.refund).toHaveBeenCalledWith(payment);
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

  describe('sendBookingConfirmationEmail', () => {
    it('should send a confirmation email with correct data', async () => {
      mocks.classRepository.getBookingById.mockResolvedValue(
        bookingDetail(
          {
            id: 'book-1',
            customerName: 'Jane Doe',
            customerEmail: 'jane@test.com',
            bookingToken: 'tok-abc',
            quantity: 1,
          },
          paidPayment(5000),
          factory.classInstance({ date: '2099-12-01', startTime: '10:00', durationMinutes: 60 }),
          factory.classCatalog({ name: 'Welding Class' }),
        ),
      );
      mocks.mailgunRepository.sendTemplate.mockResolvedValue(undefined as never);

      await sut.sendBookingConfirmationEmail('book-1');

      expect(mocks.mailgunRepository.sendTemplate).toHaveBeenCalledWith(
        'jane@test.com',
        'Starforge Classes <classes@starforgefoundry.com>',
        'classes@starforgefoundry.com',
        'Class Booking Confirmation - Welding Class',
        'class_booking',
        expect.objectContaining({
          customerName: 'Jane Doe',
          className: 'Welding Class',
          quantity: '1',
          amountPaid: '50.00',
          bookingUrl: 'https://orion.example.com/classes/booking/tok-abc',
        }),
      );
    });

    it('should throw when booking not found', async () => {
      mocks.classRepository.getBookingById.mockResolvedValue(null);

      await expect(sut.sendBookingConfirmationEmail('bad-id')).rejects.toThrow('Booking not found');
    });
  });

  describe('getTeacherCalendarLink', () => {
    it('returns null when the Google service account is not configured', async () => {
      const result = await sut.getTeacherCalendarLink(
        factory.user({ email: 'teacher@test.com', googleCalendarId: null }),
      );

      expect(result).toBeNull();
    });
  });
});
