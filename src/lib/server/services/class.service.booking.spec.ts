import type { ClassBooking, ClassInstance, Payment } from '$lib/server/db/schema';
import { UserError } from '$lib/errors';
import { PaymentDeclinedError } from '$lib/server/gateways/payment.gateway';
import { SPACE_ZONE, spaceDate } from '$lib/utils/space';
import { PAYMENT_STATUS } from '$lib/utils/billing';
import { factory } from '$test/factory';
import { newTestService, stubSettings, type ServiceMocks } from '$test/utils';
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
    const instance = factory.classInstanceDetail(
      { id: 'inst-1', date: '2099-12-01', startTime: '10:00', seats: 10 },
      catalog,
    );
    const authorized = factory.payment({
      id: PAYMENT_ID,
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
      mocks.paymentGateway.capture.mockResolvedValue(
        factory.paidPayment({ id: PAYMENT_ID, total: 5000 }),
      );
      mocks.memberRepository.customerColumns.mockImplementation(async (customer) => ({
        memberId: member.id,
        customerName: customer.customerName,
        customerEmail: customer.customerEmail,
        customerPhone: customer.customerPhone,
      }));
      mocks.classRepository.createBooking.mockResolvedValue(booking);
      mocks.mailgunGateway.sendTemplate.mockResolvedValue(undefined as never);
      mocks.classRepository.getBookingById.mockResolvedValue(
        factory.classBookingDetail(
          { ...booking, customerName: dto.customerName, customerEmail: dto.customerEmail },
          factory.paidPayment({ id: PAYMENT_ID, total: 5000 }),
          factory.classInstance({ date: '2099-12-01', startTime: '10:00', durationMinutes: 60 }),
          factory.classCatalog({ name: 'Welding Class' }),
        ),
      );
    });

    it('should process a booking successfully', async () => {
      const result = await sut.bookClass(dto, NOW);

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
        paymentId: PAYMENT_ID,
        status: 'confirmed',
        quantity: 1,
      });
      expect(mocks.paymentGateway.capture).toHaveBeenCalledWith(authorized);
    });

    it('should throw when instance not found', async () => {
      mocks.classRepository.getInstanceById.mockResolvedValue(null);

      await expect(sut.bookClass(dto, NOW)).rejects.toThrow('Class not found');
    });

    it('should throw when instance is canceled', async () => {
      mocks.classRepository.getInstanceById.mockResolvedValue({
        ...instance,
        status: 'canceled',
      });

      await expect(sut.bookClass(dto, NOW)).rejects.toThrow('This class has been canceled');
    });

    it('should throw when class date is in the past', async () => {
      mocks.classRepository.getInstanceById.mockResolvedValue({ ...instance, date: '2000-01-01' });

      await expect(sut.bookClass(dto, NOW)).rejects.toThrow('Cannot book a class in the past');
    });

    it('should throw when class is fully booked', async () => {
      mocks.classRepository.getConfirmedBookingCount.mockResolvedValue(10);

      await expect(sut.bookClass(dto, NOW)).rejects.toThrow('This class is fully booked');
      await expect(sut.bookClass(dto, NOW)).rejects.toBeInstanceOf(UserError);
    });

    it('should throw when the card is declined', async () => {
      mocks.paymentGateway.authorize.mockRejectedValue(new PaymentDeclinedError());

      await expect(sut.bookClass(dto, NOW)).rejects.toThrow('Payment failed');
      expect(mocks.classRepository.createBooking).not.toHaveBeenCalled();
    });

    it('should cancel the booking when the capture fails', async () => {
      mocks.paymentGateway.capture.mockRejectedValue(new PaymentDeclinedError());
      mocks.classRepository.updateBooking.mockResolvedValue(factory.classBooking());

      await expect(sut.bookClass(dto, NOW)).rejects.toThrow('Payment failed');
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

      await expect(sut.bookClass(dto, NOW)).rejects.toThrow('This class is fully booked');
      expect(mocks.classRepository.updateBooking).toHaveBeenCalledWith('book-1', {
        status: 'canceled',
      });
      expect(mocks.paymentGateway.void).toHaveBeenCalledWith(authorized);
      expect(mocks.paymentGateway.capture).not.toHaveBeenCalled();
    });
  });

  describe('cancelBooking', () => {
    it('should cancel a booking and refund payment', async () => {
      const payment = factory.paidPayment({ id: PAYMENT_ID, total: 5000 });
      const booking = factory.classBookingDetail({ id: 'book-1', status: 'confirmed' }, payment);
      mocks.classRepository.getBookingByToken.mockResolvedValue(booking);
      mocks.paymentGateway.refund.mockResolvedValue(true);
      mocks.classRepository.updateBooking.mockResolvedValue(factory.classBooking());

      const result = await sut.cancelBooking({ bookingToken: 'tok-abc' }, NOW);

      expect(result).toEqual({ success: true, instanceId: booking.instanceId });
      expect(mocks.paymentGateway.refund).toHaveBeenCalledWith(payment);
      expect(mocks.classRepository.updateBooking).toHaveBeenCalledWith('book-1', {
        status: 'canceled',
      });
    });

    it('should cancel without refund when no payment exists', async () => {
      mocks.classRepository.getBookingByToken.mockResolvedValue(
        factory.classBookingDetail({ id: 'book-1', status: 'confirmed' }, null),
      );
      mocks.classRepository.updateBooking.mockResolvedValue(factory.classBooking());

      await sut.cancelBooking({ bookingToken: 'tok-abc' }, NOW);

      expect(mocks.paymentGateway.refund).not.toHaveBeenCalled();
      expect(mocks.classRepository.updateBooking).toHaveBeenCalledWith('book-1', {
        status: 'canceled',
      });
    });

    it('rejects customer cancellation once the class has started', async () => {
      const instance = factory.classInstance({ date: '2026-10-16', startTime: '10:00' });
      const justAfterStart = DateTime.fromISO('2026-10-16T10:01', { zone: SPACE_ZONE });
      mocks.classRepository.getBookingByToken.mockResolvedValue(
        factory.classBookingDetail(
          { status: 'confirmed' },
          factory.paidPayment({ id: PAYMENT_ID, total: 5000 }),
          instance,
        ),
      );

      await expect(sut.cancelBooking({ bookingToken: 'tok-abc' }, justAfterStart)).rejects.toThrow(
        'already started',
      );
      expect(mocks.paymentGateway.refund).not.toHaveBeenCalled();
      expect(mocks.classRepository.updateBooking).not.toHaveBeenCalled();
    });

    it('should throw when booking not found', async () => {
      mocks.classRepository.getBookingByToken.mockResolvedValue(null);

      await expect(sut.cancelBooking({ bookingToken: 'bad-token' }, NOW)).rejects.toThrow(
        'Booking not found',
      );
    });

    it('should throw when booking already canceled', async () => {
      mocks.classRepository.getBookingByToken.mockResolvedValue(
        factory.classBookingDetail({ id: 'book-1', status: 'canceled' }),
      );

      await expect(sut.cancelBooking({ bookingToken: 'tok-abc' }, NOW)).rejects.toThrow(
        'Booking is already canceled',
      );
    });
  });

  describe('cancelBookingStaff', () => {
    it('should cancel a booking by id and refund', async () => {
      const payment = factory.paidPayment({ id: PAYMENT_ID, total: 3000 });
      const booking = factory.classBookingDetail({ id: 'book-1', status: 'confirmed' }, payment);
      mocks.classRepository.getBookingById.mockResolvedValue(booking);
      mocks.paymentGateway.refund.mockResolvedValue(true);
      mocks.classRepository.updateBooking.mockResolvedValue(factory.classBooking());

      const result = await sut.cancelBookingStaff({ bookingId: 'book-1' });

      expect(result).toEqual({ success: true, instanceId: booking.instanceId });
      expect(mocks.paymentGateway.refund).toHaveBeenCalledWith(payment);
    });

    it('lets staff cancel a class that already started', async () => {
      mocks.classRepository.getBookingById.mockResolvedValue(
        factory.classBookingDetail(
          { id: 'book-1', status: 'confirmed' },
          null,
          factory.classInstance({ date: '2000-01-01' }),
        ),
      );
      mocks.classRepository.updateBooking.mockResolvedValue(factory.classBooking());

      await expect(sut.cancelBookingStaff({ bookingId: 'book-1' })).resolves.toMatchObject({
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
        factory.classBookingDetail({ id: 'book-1', status: 'canceled' }),
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
        factory.classBookingDetail(
          { id: 'book-1', instanceId: SOURCE_ID, quantity: 2, ...overrides },
          payment,
          factory.classInstance({ id: SOURCE_ID, classId: CLASS_ID }),
        ),
      );
    }

    function stubTarget(overrides: Partial<ClassInstance> = {}) {
      mocks.classRepository.getInstanceById.mockResolvedValue(
        factory.classInstanceDetail({ id: TARGET_ID, classId: CLASS_ID, seats: 10, ...overrides }),
      );
    }

    function stubCounts(before: number, after: number) {
      mocks.classRepository.getConfirmedBookingsForInstance.mockResolvedValue([
        factory.classBookingWithPayment({
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
      stubBooking({}, factory.paidPayment({ id: PAYMENT_ID, total: 5000 }));
      stubTarget();
      stubCounts(8, 10);
      const moved = factory.classBooking({ id: 'book-1', instanceId: TARGET_ID });
      mocks.classRepository.updateBooking.mockResolvedValue(moved);

      const result = await sut.rescheduleBooking(dto, NOW);

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

      await expect(sut.rescheduleBooking(dto, NOW)).rejects.toThrow('Booking not found');
    });

    it('should throw when booking is canceled', async () => {
      stubBooking({ status: 'canceled' });

      await expect(sut.rescheduleBooking(dto, NOW)).rejects.toThrow('Booking is already canceled');
    });

    it('should throw when target is the current session', async () => {
      stubBooking({ instanceId: TARGET_ID });

      await expect(sut.rescheduleBooking(dto, NOW)).rejects.toThrow(
        'Booking is already in this class session',
      );
    });

    it('should throw when target session not found', async () => {
      stubBooking();
      mocks.classRepository.getInstanceById.mockResolvedValue(null);

      await expect(sut.rescheduleBooking(dto, NOW)).rejects.toThrow('Class not found');
    });

    it('should throw when target belongs to another class', async () => {
      stubBooking();
      stubTarget({ classId: 'class-2' });

      await expect(sut.rescheduleBooking(dto, NOW)).rejects.toThrow(
        'Bookings can only move to a session of the same class',
      );
    });

    it('should throw when target session is canceled', async () => {
      stubBooking();
      stubTarget({ status: 'canceled' });

      await expect(sut.rescheduleBooking(dto, NOW)).rejects.toThrow('This class has been canceled');
    });

    it('should throw when target session is in the past', async () => {
      stubBooking();
      stubTarget({ date: spaceDate(NOW.minus({ days: 1 })) });

      await expect(sut.rescheduleBooking(dto, NOW)).rejects.toThrow(
        'Cannot book a class in the past',
      );
    });

    it('should throw when customer is already booked in the target session', async () => {
      stubBooking({ customerEmail: 'jane@example.com' });
      stubTarget();
      mocks.classRepository.getConfirmedBookingsForInstance.mockResolvedValue([
        factory.classBookingWithPayment({
          instanceId: TARGET_ID,
          customerEmail: 'Jane@Example.com',
        }),
      ]);

      await expect(sut.rescheduleBooking(dto, NOW)).rejects.toThrow(
        'Customer is already booked in that session',
      );
    });

    it('should throw when target session lacks capacity', async () => {
      stubBooking();
      stubTarget();
      stubCounts(9, 9);

      await expect(sut.rescheduleBooking(dto, NOW)).rejects.toThrow('Only 1 spot remaining');
      expect(mocks.classRepository.updateBooking).not.toHaveBeenCalled();
    });

    it('should move the booking back when a concurrent booking overfills the target', async () => {
      const reminderSentDate = NOW;
      stubBooking({ reminderSentDate });
      stubTarget();
      stubCounts(8, 11);
      mocks.classRepository.updateBooking.mockResolvedValue(factory.classBooking());
      await expect(sut.rescheduleBooking(dto, NOW)).rejects.toThrow('This class is fully booked');
      expect(mocks.classRepository.updateBooking).toHaveBeenLastCalledWith('book-1', {
        instanceId: SOURCE_ID,
        reminderSentDate,
      });
      expect(mocks.mailgunGateway.sendTemplate).not.toHaveBeenCalled();
    });

    describe('confirmation email', () => {
      beforeEach(() => {
        mocks.classRepository.getBookingById.mockResolvedValue(
          factory.classBookingDetail(
            {
              id: 'book-1',
              instanceId: SOURCE_ID,
              customerName: 'Jane Doe',
              customerEmail: 'jane@test.com',
              bookingToken: 'tok-abc',
              passToken: 'pass-abc',
              quantity: 1,
            },
            factory.paidPayment({ id: PAYMENT_ID, total: 5000 }),
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

        await sut.rescheduleBooking(dto, NOW);

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

        await expect(sut.rescheduleBooking(dto, NOW)).resolves.toMatchObject({
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
});
