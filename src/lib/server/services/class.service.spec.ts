import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('$lib/server/repositories/class.repository', () => {
  const MockClassRepository = vi.fn();
  MockClassRepository.prototype.createCatalog = vi.fn();
  MockClassRepository.prototype.updateCatalog = vi.fn();
  MockClassRepository.prototype.getCatalogById = vi.fn();
  MockClassRepository.prototype.getAllCatalogs = vi.fn();
  MockClassRepository.prototype.uploadClassPhoto = vi.fn();
  MockClassRepository.prototype.createInstance = vi.fn();
  MockClassRepository.prototype.createInstances = vi.fn();
  MockClassRepository.prototype.updateInstance = vi.fn();
  MockClassRepository.prototype.getInstanceById = vi.fn();
  MockClassRepository.prototype.getInstancesForCatalog = vi.fn();
  MockClassRepository.prototype.getAllInstances = vi.fn();
  MockClassRepository.prototype.getScheduledInstancesByRecurrenceGroup = vi.fn();
  MockClassRepository.prototype.createBooking = vi.fn();
  MockClassRepository.prototype.getBookingById = vi.fn();
  MockClassRepository.prototype.getBookingByToken = vi.fn();
  MockClassRepository.prototype.updateBooking = vi.fn();
  MockClassRepository.prototype.getBookingsForInstance = vi.fn();
  MockClassRepository.prototype.getConfirmedBookingsForInstance = vi.fn();
  MockClassRepository.prototype.getConfirmedBookingCount = vi.fn();
  MockClassRepository.prototype.getStaffUsers = vi.fn();
  MockClassRepository.prototype.processSquarePayment = vi.fn();
  MockClassRepository.prototype.refundPayment = vi.fn();
  MockClassRepository.prototype.setGoogleCalendarId = vi.fn();
  MockClassRepository.prototype.setGoogleEventId = vi.fn();
  MockClassRepository.prototype.getScheduledInstanceIdsForTeacher = vi.fn();
  return { ClassRepository: MockClassRepository };
});

vi.mock('$lib/server/repositories/google_calendar.repository', () => {
  const MockGoogleCalendarRepository = vi.fn();
  MockGoogleCalendarRepository.prototype.isConfigured = vi.fn(() => false);
  MockGoogleCalendarRepository.prototype.createCalendar = vi.fn();
  MockGoogleCalendarRepository.prototype.makeCalendarPublic = vi.fn();
  MockGoogleCalendarRepository.prototype.createEvent = vi.fn();
  MockGoogleCalendarRepository.prototype.updateEvent = vi.fn();
  MockGoogleCalendarRepository.prototype.deleteEvent = vi.fn();
  MockGoogleCalendarRepository.prototype.buildAddCalendarUrl = vi.fn();
  return { GoogleCalendarRepository: MockGoogleCalendarRepository };
});

vi.mock('$lib/server/repositories/mailgun.repository', () => {
  const MockMailgunRepository = vi.fn();
  MockMailgunRepository.prototype.sendTemplate = vi.fn();
  return { MailgunRepository: MockMailgunRepository };
});

vi.mock('$lib/server/repositories/settings.repository', () => {
  const MockSettingsRepository = vi.fn();
  MockSettingsRepository.prototype.getSetting = vi.fn();
  return { SettingsRepository: MockSettingsRepository };
});

vi.mock('$app/server', () => ({
  getRequestEvent: vi.fn(() => ({ platform: { ctx: { waitUntil: vi.fn() } } })),
}));

vi.mock('$env/dynamic/private', () => ({
  env: { FRONTEND_URL: 'https://example.com' },
}));

vi.mock('$lib/frontend/utils', () => ({
  formatTime: vi.fn((t: string) => t),
}));

describe('ClassService', () => {
  let classService: any;
  let mockClassRepo: any;
  let mockMailgunRepo: any;
  let mockSettingsRepo: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { ClassService } = await import('./class.service');
    classService = new ClassService();

    const { ClassRepository } = await import('$lib/server/repositories/class.repository');
    mockClassRepo = ClassRepository.prototype;

    const { MailgunRepository } = await import('$lib/server/repositories/mailgun.repository');
    mockMailgunRepo = MailgunRepository.prototype;

    const { SettingsRepository } = await import('$lib/server/repositories/settings.repository');
    mockSettingsRepo = SettingsRepository.prototype;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── Catalog ──

  describe('createCatalog', () => {
    it('should create a catalog entry', async () => {
      const dto = { name: 'Welding Class', description: 'Intro class', price: 5000 };
      const expected = { id: 'cat-1', ...dto };
      vi.mocked(mockClassRepo.createCatalog).mockResolvedValue(expected);

      const result = await classService.createCatalog(dto);

      expect(mockClassRepo.createCatalog).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expected);
    });
  });

  describe('updateCatalog', () => {
    it('should update a catalog by id', async () => {
      const dto = { id: 'cat-1', name: 'Pottery 201', description: 'Advanced', price: 7500 };
      const expected = { ...dto };
      vi.mocked(mockClassRepo.updateCatalog).mockResolvedValue(expected);

      const result = await classService.updateCatalog(dto);

      expect(mockClassRepo.updateCatalog).toHaveBeenCalledWith('cat-1', {
        name: 'Pottery 201',
        description: 'Advanced',
        price: 7500,
      });
      expect(result).toEqual(expected);
    });
  });

  describe('getCatalogById', () => {
    it('should return catalog by id', async () => {
      const catalog = { id: 'cat-1', name: 'Welding Class' };
      vi.mocked(mockClassRepo.getCatalogById).mockResolvedValue(catalog);

      const result = await classService.getCatalogById('cat-1');

      expect(mockClassRepo.getCatalogById).toHaveBeenCalledWith('cat-1');
      expect(result).toEqual(catalog);
    });
  });

  describe('getAllCatalogs', () => {
    it('should return all catalogs', async () => {
      const catalogs = [{ id: 'cat-1' }, { id: 'cat-2' }];
      vi.mocked(mockClassRepo.getAllCatalogs).mockResolvedValue(catalogs);

      const result = await classService.getAllCatalogs();

      expect(result).toHaveLength(2);
    });
  });

  describe('getActiveCatalogsWithInstances', () => {
    it('should return active catalogs with future instances and booking counts', async () => {
      const catalogs = [{ id: 'cat-1', name: 'Pottery' }];
      const instances = [
        { id: 'inst-1', date: '2099-12-01', teacher: null },
        { id: 'inst-2', date: '2099-12-08', teacher: null },
      ];

      vi.mocked(mockClassRepo.getAllCatalogs).mockResolvedValue(catalogs);
      vi.mocked(mockClassRepo.getInstancesForCatalog).mockResolvedValue(instances);
      vi.mocked(mockClassRepo.getConfirmedBookingCount).mockResolvedValue(3);

      const result = await classService.getActiveCatalogsWithInstances();

      expect(result).toHaveLength(1);
      expect(result[0].instances).toHaveLength(2);
      expect(result[0].instances[0].confirmedCount).toBe(3);
    });

    it('should exclude catalogs with no future instances', async () => {
      const catalogs = [{ id: 'cat-1' }];
      const instances = [{ id: 'inst-1', date: '2000-01-01', teacher: null }];

      vi.mocked(mockClassRepo.getAllCatalogs).mockResolvedValue(catalogs);
      vi.mocked(mockClassRepo.getInstancesForCatalog).mockResolvedValue(instances);

      const result = await classService.getActiveCatalogsWithInstances();

      expect(result).toHaveLength(0);
    });
  });

  describe('uploadClassPhoto', () => {
    it('should upload photo and update catalog', async () => {
      const file = new File(['data'], 'photo.jpg');
      vi.mocked(mockClassRepo.uploadClassPhoto).mockResolvedValue('https://s3/photo.jpg');
      vi.mocked(mockClassRepo.updateCatalog).mockResolvedValue({});

      const result = await classService.uploadClassPhoto('cat-1', file);

      expect(mockClassRepo.uploadClassPhoto).toHaveBeenCalledWith('cat-1', file);
      expect(mockClassRepo.updateCatalog).toHaveBeenCalledWith('cat-1', {
        photoUrl: 'https://s3/photo.jpg',
      });
      expect(result).toBe('https://s3/photo.jpg');
    });
  });

  // ── Instance ──

  describe('generateInstances', () => {
    it('should generate weekly instances between start and end dates', async () => {
      const dto = {
        classId: 'cat-1',
        teacherEmail: 'teacher@test.com',
        dayOfWeek: 1, // Monday (0=Sun..6=Sat)
        startTime: '10:00',
        durationMinutes: 60,
        seats: 10,
        startDate: '2099-01-05', // a Monday
        endDate: '2099-01-19', // 3 Mondays
      };

      vi.mocked(mockClassRepo.createInstances).mockResolvedValue([]);

      await classService.generateInstances(dto);

      expect(mockClassRepo.createInstances).toHaveBeenCalledTimes(1);
      const createdInstances = vi.mocked(mockClassRepo.createInstances).mock.calls[0][0];
      expect(createdInstances).toHaveLength(3);
      expect(createdInstances[0].date).toBe('2099-01-05');
      expect(createdInstances[1].date).toBe('2099-01-12');
      expect(createdInstances[2].date).toBe('2099-01-19');
      // All share the same recurrenceGroupId
      expect(createdInstances[0].recurrenceGroupId).toBe(createdInstances[1].recurrenceGroupId);
    });

    it('should handle no matching days in range', async () => {
      const dto = {
        classId: 'cat-1',
        teacherEmail: 'teacher@test.com',
        dayOfWeek: 0, // Sunday
        startTime: '10:00',
        durationMinutes: 60,
        seats: 10,
        startDate: '2099-01-06', // Monday
        endDate: '2099-01-10', // Friday — no Sunday in this range
      };

      vi.mocked(mockClassRepo.createInstances).mockResolvedValue([]);

      await classService.generateInstances(dto);

      const createdInstances = vi.mocked(mockClassRepo.createInstances).mock.calls[0][0];
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
      const expected = { id: 'inst-1', ...dto, status: 'scheduled' };
      vi.mocked(mockClassRepo.createInstance).mockResolvedValue(expected);

      const result = await classService.createInstance(dto);

      expect(mockClassRepo.createInstance).toHaveBeenCalledWith({
        ...dto,
        status: 'scheduled',
      });
      expect(result).toEqual(expected);
    });
  });

  describe('updateInstance', () => {
    it('should update instance with only defined fields', async () => {
      const dto = { id: 'inst-1', seats: 12, teacherEmail: undefined };
      vi.mocked(mockClassRepo.updateInstance).mockResolvedValue({});

      await classService.updateInstance(dto);

      expect(mockClassRepo.updateInstance).toHaveBeenCalledWith('inst-1', { seats: 12 });
    });
  });

  describe('cancelInstance', () => {
    it('should cancel a single instance and refund bookings', async () => {
      const instance = {
        id: 'inst-1',
        status: 'scheduled',
        recurrenceGroupId: null,
        date: '2099-06-15',
      };
      const bookings = [
        { id: 'book-1', squarePaymentId: 'pay-1', amountPaid: 5000 },
        { id: 'book-2', squarePaymentId: null, amountPaid: 0 },
      ];

      vi.mocked(mockClassRepo.getInstanceById).mockResolvedValue(instance);
      vi.mocked(mockClassRepo.getConfirmedBookingsForInstance).mockResolvedValue(bookings);
      vi.mocked(mockClassRepo.refundPayment).mockResolvedValue({});
      vi.mocked(mockClassRepo.updateBooking).mockResolvedValue({});
      vi.mocked(mockClassRepo.updateInstance).mockResolvedValue({});

      const result = await classService.cancelInstance({
        instanceId: 'inst-1',
        mode: 'single',
      });

      expect(result.canceledCount).toBe(1);
      expect(mockClassRepo.refundPayment).toHaveBeenCalledTimes(1);
      expect(mockClassRepo.refundPayment).toHaveBeenCalledWith('pay-1', 5000);
      expect(mockClassRepo.updateBooking).toHaveBeenCalledTimes(2);
      expect(mockClassRepo.updateInstance).toHaveBeenCalledWith('inst-1', { status: 'canceled' });
    });

    it('should cancel this and future instances in a recurrence group', async () => {
      const instance = {
        id: 'inst-2',
        status: 'scheduled',
        recurrenceGroupId: 'group-1',
        date: '2099-06-15',
      };
      const futureInstances = [
        { id: 'inst-2', date: '2099-06-15' },
        { id: 'inst-3', date: '2099-06-22' },
      ];

      vi.mocked(mockClassRepo.getInstanceById).mockResolvedValue(instance);
      vi.mocked(mockClassRepo.getScheduledInstancesByRecurrenceGroup).mockResolvedValue(
        futureInstances,
      );
      vi.mocked(mockClassRepo.getConfirmedBookingsForInstance).mockResolvedValue([]);
      vi.mocked(mockClassRepo.updateInstance).mockResolvedValue({});

      const result = await classService.cancelInstance({
        instanceId: 'inst-2',
        mode: 'this_and_future',
      });

      expect(result.canceledCount).toBe(2);
      expect(mockClassRepo.updateInstance).toHaveBeenCalledTimes(2);
    });

    it('should throw when instance not found', async () => {
      vi.mocked(mockClassRepo.getInstanceById).mockResolvedValue(null);

      await expect(
        classService.cancelInstance({ instanceId: 'bad-id', mode: 'single' }),
      ).rejects.toThrow('Instance not found');
    });

    it('should handle refund failure gracefully and still cancel', async () => {
      const instance = {
        id: 'inst-1',
        status: 'scheduled',
        recurrenceGroupId: null,
        date: '2099-06-15',
      };
      const bookings = [{ id: 'book-1', squarePaymentId: 'pay-1', amountPaid: 5000 }];

      vi.mocked(mockClassRepo.getInstanceById).mockResolvedValue(instance);
      vi.mocked(mockClassRepo.getConfirmedBookingsForInstance).mockResolvedValue(bookings);
      vi.mocked(mockClassRepo.refundPayment).mockRejectedValue(new Error('Square error'));
      vi.mocked(mockClassRepo.updateBooking).mockResolvedValue({});
      vi.mocked(mockClassRepo.updateInstance).mockResolvedValue({});

      const result = await classService.cancelInstance({
        instanceId: 'inst-1',
        mode: 'single',
      });

      // Should still cancel the booking and instance despite refund failure
      expect(result.canceledCount).toBe(1);
      expect(mockClassRepo.updateBooking).toHaveBeenCalledWith('book-1', { status: 'canceled' });
      expect(mockClassRepo.updateInstance).toHaveBeenCalledWith('inst-1', { status: 'canceled' });
    });
  });

  describe('getAllInstances', () => {
    it('should return instances with confirmed counts', async () => {
      const instances = [
        { id: 'inst-1', teacher: null, catalog: null },
        { id: 'inst-2', teacher: null, catalog: null },
      ];
      vi.mocked(mockClassRepo.getAllInstances).mockResolvedValue(instances);
      vi.mocked(mockClassRepo.getConfirmedBookingCount)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(5);

      const result = await classService.getAllInstances();

      expect(result).toHaveLength(2);
      expect(result[0].confirmedCount).toBe(2);
      expect(result[1].confirmedCount).toBe(5);
    });
  });

  describe('getInstanceDetail', () => {
    it('should return instance with bookings', async () => {
      const instance = { id: 'inst-1', teacher: null, catalog: null };
      const bookings = [{ id: 'book-1' }, { id: 'book-2' }];

      vi.mocked(mockClassRepo.getInstanceById).mockResolvedValue(instance);
      vi.mocked(mockClassRepo.getBookingsForInstance).mockResolvedValue(bookings);

      const result = await classService.getInstanceDetail('inst-1');

      expect(result).toEqual({ ...instance, bookings });
    });

    it('should return null when instance not found', async () => {
      vi.mocked(mockClassRepo.getInstanceById).mockResolvedValue(null);

      const result = await classService.getInstanceDetail('bad-id');

      expect(result).toBeNull();
    });
  });

  describe('getStaffUsers', () => {
    it('should delegate to repository', async () => {
      const users = [{ email: 'a@test.com' }];
      vi.mocked(mockClassRepo.getStaffUsers).mockResolvedValue(users);

      const result = await classService.getStaffUsers();

      expect(result).toEqual(users);
    });
  });

  // ── Booking ──

  describe('bookClass', () => {
    const dto = {
      instanceId: 'inst-1',
      customerName: 'Jane Doe',
      customerEmail: 'jane@test.com',
      customerPhone: '555-1234',
      quantity: 1,
      sourceId: 'sq-nonce-123',
    };

    const instance = {
      id: 'inst-1',
      status: 'scheduled',
      date: '2099-12-01',
      startTime: '10:00',
      seats: 10,
      catalog: { id: 'cat-1', name: 'Welding Class', price: 5000 },
    };

    const payment = { id: 'pay-1', status: 'COMPLETED' };

    const booking = {
      id: 'book-1',
      instanceId: 'inst-1',
      bookingToken: 'tok-abc',
      status: 'confirmed',
    };

    beforeEach(() => {
      vi.mocked(mockClassRepo.getInstanceById).mockResolvedValue(instance);
      vi.mocked(mockClassRepo.getConfirmedBookingCount).mockResolvedValue(0);
      vi.mocked(mockSettingsRepo.getSetting).mockResolvedValue({ locationId: 'loc-1' });
      vi.mocked(mockClassRepo.processSquarePayment).mockResolvedValue(payment);
      vi.mocked(mockClassRepo.createBooking).mockResolvedValue(booking);
      vi.mocked(mockMailgunRepo.sendTemplate).mockResolvedValue({});
      vi.mocked(mockClassRepo.getBookingById).mockResolvedValue({
        ...booking,
        customerName: dto.customerName,
        customerEmail: dto.customerEmail,
        quantity: 1,
        amountPaid: 5000,
        instance: { date: '2099-12-01', startTime: '10:00', durationMinutes: 60 },
        catalog: { name: 'Welding Class' },
      });
    });

    it('should process a booking successfully', async () => {
      const result = await classService.bookClass(dto);

      expect(result).toEqual(booking);
      expect(mockClassRepo.processSquarePayment).toHaveBeenCalledWith(
        'sq-nonce-123',
        5000,
        'loc-1',
        'jane@test.com',
        'Jane Doe',
        'Welding Class',
        expect.stringContaining('Class booking'),
      );
      expect(mockClassRepo.createBooking).toHaveBeenCalledWith({
        instanceId: 'inst-1',
        customerName: 'Jane Doe',
        customerEmail: 'jane@test.com',
        customerPhone: '555-1234',
        squarePaymentId: 'pay-1',
        status: 'confirmed',
        quantity: 1,
        amountPaid: 5000,
      });
    });

    it('should throw when instance not found', async () => {
      vi.mocked(mockClassRepo.getInstanceById).mockResolvedValue(null);

      await expect(classService.bookClass(dto)).rejects.toThrow('Class not found');
    });

    it('should throw when instance is canceled', async () => {
      vi.mocked(mockClassRepo.getInstanceById).mockResolvedValue({
        ...instance,
        status: 'canceled',
      });

      await expect(classService.bookClass(dto)).rejects.toThrow('This class has been canceled');
    });

    it('should throw when class date is in the past', async () => {
      vi.mocked(mockClassRepo.getInstanceById).mockResolvedValue({
        ...instance,
        date: '2000-01-01',
      });

      await expect(classService.bookClass(dto)).rejects.toThrow('Cannot book a class in the past');
    });

    it('should throw when class is fully booked', async () => {
      vi.mocked(mockClassRepo.getConfirmedBookingCount).mockResolvedValue(10);

      await expect(classService.bookClass(dto)).rejects.toThrow('This class is fully booked');
    });

    it('should throw when payment fails', async () => {
      vi.mocked(mockClassRepo.processSquarePayment).mockResolvedValue(null);

      await expect(classService.bookClass(dto)).rejects.toThrow('Payment failed');
    });

    it('should throw when payment status is not COMPLETED', async () => {
      vi.mocked(mockClassRepo.processSquarePayment).mockResolvedValue({
        id: 'pay-1',
        status: 'FAILED',
      });

      await expect(classService.bookClass(dto)).rejects.toThrow('Payment failed');
    });

    it('should refund and cancel if overbooking detected after insert', async () => {
      // First call returns 0 (pre-check passes), second call returns 11 (overbooked)
      vi.mocked(mockClassRepo.getConfirmedBookingCount)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(11);
      vi.mocked(mockClassRepo.updateBooking).mockResolvedValue({});
      vi.mocked(mockClassRepo.refundPayment).mockResolvedValue({});

      await expect(classService.bookClass(dto)).rejects.toThrow('This class is fully booked');
      expect(mockClassRepo.updateBooking).toHaveBeenCalledWith('book-1', { status: 'canceled' });
      expect(mockClassRepo.refundPayment).toHaveBeenCalledWith('pay-1', 5000);
    });
  });

  describe('cancelBooking', () => {
    it('should cancel a booking and refund payment', async () => {
      const booking = {
        id: 'book-1',
        status: 'confirmed',
        squarePaymentId: 'pay-1',
        amountPaid: 5000,
      };
      vi.mocked(mockClassRepo.getBookingByToken).mockResolvedValue(booking);
      vi.mocked(mockClassRepo.refundPayment).mockResolvedValue({});
      vi.mocked(mockClassRepo.updateBooking).mockResolvedValue({});

      const result = await classService.cancelBooking({ bookingToken: 'tok-abc' });

      expect(result).toEqual({ success: true });
      expect(mockClassRepo.refundPayment).toHaveBeenCalledWith('pay-1', 5000);
      expect(mockClassRepo.updateBooking).toHaveBeenCalledWith('book-1', { status: 'canceled' });
    });

    it('should cancel without refund when no payment exists', async () => {
      const booking = {
        id: 'book-1',
        status: 'confirmed',
        squarePaymentId: null,
        amountPaid: 0,
      };
      vi.mocked(mockClassRepo.getBookingByToken).mockResolvedValue(booking);
      vi.mocked(mockClassRepo.updateBooking).mockResolvedValue({});

      await classService.cancelBooking({ bookingToken: 'tok-abc' });

      expect(mockClassRepo.refundPayment).not.toHaveBeenCalled();
      expect(mockClassRepo.updateBooking).toHaveBeenCalledWith('book-1', { status: 'canceled' });
    });

    it('should throw when booking not found', async () => {
      vi.mocked(mockClassRepo.getBookingByToken).mockResolvedValue(null);

      await expect(classService.cancelBooking({ bookingToken: 'bad-token' })).rejects.toThrow(
        'Booking not found',
      );
    });

    it('should throw when booking already canceled', async () => {
      vi.mocked(mockClassRepo.getBookingByToken).mockResolvedValue({
        id: 'book-1',
        status: 'canceled',
      });

      await expect(classService.cancelBooking({ bookingToken: 'tok-abc' })).rejects.toThrow(
        'Booking is already canceled',
      );
    });
  });

  describe('cancelBookingStaff', () => {
    it('should cancel a booking by id and refund', async () => {
      const booking = {
        id: 'book-1',
        status: 'confirmed',
        squarePaymentId: 'pay-1',
        amountPaid: 3000,
      };
      vi.mocked(mockClassRepo.getBookingById).mockResolvedValue(booking);
      vi.mocked(mockClassRepo.refundPayment).mockResolvedValue({});
      vi.mocked(mockClassRepo.updateBooking).mockResolvedValue({});

      const result = await classService.cancelBookingStaff({ bookingId: 'book-1' });

      expect(result).toEqual({ success: true });
      expect(mockClassRepo.refundPayment).toHaveBeenCalledWith('pay-1', 3000);
    });

    it('should throw when booking not found', async () => {
      vi.mocked(mockClassRepo.getBookingById).mockResolvedValue(null);

      await expect(classService.cancelBookingStaff({ bookingId: 'bad-id' })).rejects.toThrow(
        'Booking not found',
      );
    });

    it('should throw when booking already canceled', async () => {
      vi.mocked(mockClassRepo.getBookingById).mockResolvedValue({
        id: 'book-1',
        status: 'canceled',
      });

      await expect(classService.cancelBookingStaff({ bookingId: 'book-1' })).rejects.toThrow(
        'Booking is already canceled',
      );
    });
  });

  // ── Email ──

  describe('sendBookingConfirmationEmail', () => {
    it('should send a confirmation email with correct data', async () => {
      vi.mocked(mockClassRepo.getBookingById).mockResolvedValue({
        id: 'book-1',
        customerName: 'Jane Doe',
        customerEmail: 'jane@test.com',
        bookingToken: 'tok-abc',
        quantity: 1,
        amountPaid: 5000,
        instance: { date: '2099-12-01', startTime: '10:00', durationMinutes: 60 },
        catalog: { name: 'Welding Class' },
      });

      await classService.sendBookingConfirmationEmail('book-1');

      expect(mockMailgunRepo.sendTemplate).toHaveBeenCalledWith(
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
          bookingUrl: 'https://example.com/classes/booking/tok-abc',
        }),
      );
    });

    it('should throw when booking not found', async () => {
      vi.mocked(mockClassRepo.getBookingById).mockResolvedValue(null);

      await expect(classService.sendBookingConfirmationEmail('bad-id')).rejects.toThrow(
        'Booking not found',
      );
    });
  });

  // ── Google Calendar sync ──

  describe('getTeacherCalendarLink', () => {
    it('returns null when the Google service account is not configured', async () => {
      const result = await classService.getTeacherCalendarLink({
        email: 'teacher@test.com',
        name: 'Teacher',
        picture: 'pic.png',
        googleCalendarId: null,
      });
      expect(result).toBeNull();
    });
  });
});
