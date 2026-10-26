import type { CarBayBooking, Payment } from '$lib/server/db/schema';
import type { CarBayBookingWithPayment } from '$lib/server/repositories/car_bay.repository';
import { PaymentDeclinedError, type NewPayment } from '$lib/server/repositories/payment.repository';
import { PAYMENT_STATUS, PAYMENT_TYPE } from '$lib/utils/billing';
import {
  CAR_BAY_ZONE,
  CarBayRuleError,
  CarBaySlotTakenError,
  DEFAULT_CAR_BAY_POLICY,
  DEFAULT_CAR_BAY_RATES,
  type CarBayPolicy,
} from '$lib/utils/car_bay';
import { factory } from '$test/factory';
import { newTestService, stubSettings, type ServiceMocks } from '$test/utils';
import { DateTime } from 'luxon';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CarBayService } from './car_bay.service';

// 2026-10-12 is a Monday.
const MONDAY = '2026-10-12';
const NOW = DateTime.fromISO(`${MONDAY}T09:00`, { zone: CAR_BAY_ZONE });
const STAFF_EMAIL = 'staff@starforgefoundry.com';

const CUSTOMER = {
  customerName: 'Jane Doe',
  customerEmail: 'jane@example.com',
  customerPhone: '555-0100',
  isMember: true,
};

const QUICK_JOB = { tier: 'quick_job', date: MONDAY, startHour: 16 } as const;

function at(iso: string) {
  return DateTime.fromISO(iso, { zone: CAR_BAY_ZONE });
}

function storedPayment(overrides: Partial<Payment> = {}) {
  return factory.payment({
    id: 'payment-1',
    type: PAYMENT_TYPE.CAR_BAY_BOOKING,
    status: PAYMENT_STATUS.PAID,
    total: 1200,
    squarePaymentId: 'pay-1',
    ...overrides,
  });
}

function bookingRow(overrides: Partial<CarBayBooking> = {}) {
  return factory.carBayBooking({
    id: 'booking-1',
    tier: 'quick_job',
    startAt: at(`${MONDAY}T16:00`),
    endAt: at(`${MONDAY}T17:30`),
    blockedUntil: at(`${MONDAY}T18:00`),
    ...CUSTOMER,
    paymentId: 'payment-1',
    bookingToken: 'token-1',
    createdDate: NOW.minus({ days: 2 }),
    ...overrides,
  });
}

function storedBooking(
  overrides: Partial<CarBayBookingWithPayment> = {},
): CarBayBookingWithPayment {
  return { ...bookingRow(), payment: storedPayment(), ...overrides };
}

function savedPayment(payment: NewPayment, id?: string) {
  return factory.payment({
    ...(id && { id }),
    type: payment.type,
    status: payment.status,
    customerName: payment.customer.name,
    customerEmail: payment.customer.email,
    total: payment.bill.total,
    lineItems: payment.bill.lineItems,
    discounts: payment.bill.discounts,
    paymentUrl: payment.paymentUrl ?? null,
  });
}

describe(CarBayService.name, () => {
  let sut: CarBayService;
  let mocks: ServiceMocks;

  function stubCarBaySettings(policy: CarBayPolicy = DEFAULT_CAR_BAY_POLICY) {
    stubSettings(mocks.settingsRepository, {
      carBayRates: DEFAULT_CAR_BAY_RATES,
      carBayPolicy: policy,
    });
  }

  function stubOpenSlot() {
    mocks.carBayRepository.hasConfirmedForCustomer.mockResolvedValue(false);
    mocks.carBayRepository.getConfirmedInRange.mockResolvedValue([]);
    mocks.carBayRepository.getClosuresInRange.mockResolvedValue([]);
  }

  function stubCreateBooking() {
    mocks.carBayRepository.create.mockImplementation(async (data) =>
      bookingRow(data as Partial<CarBayBooking>),
    );
    mocks.mailgunRepository.sendTemplate.mockResolvedValue(undefined as never);
  }

  beforeEach(() => {
    ({ sut, mocks } = newTestService(CarBayService));
    stubCarBaySettings();
  });

  describe('book', () => {
    const dto = { request: QUICK_JOB, ...CUSTOMER, sourceId: 'cnon:card' };

    beforeEach(() => {
      stubOpenSlot();
      stubCreateBooking();
      mocks.memberRepository.getAccessContextByEmail.mockResolvedValue(
        factory.memberAccessContext({ subscriptions: [factory.memberSubscription()] }),
      );
      mocks.paymentRepository.authorize.mockImplementation(async (payment) =>
        storedPayment({ status: PAYMENT_STATUS.PENDING, total: payment.bill.total }),
      );
      mocks.paymentRepository.capture.mockImplementation(async (payment) => ({
        ...payment,
        status: PAYMENT_STATUS.PAID,
      }));
    });

    it('authorizes the card, holds the bay, then captures the payment', async () => {
      await sut.book(dto, NOW);

      expect(mocks.paymentRepository.authorize).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'car_bay_booking',
          customer: { name: 'Jane Doe', email: 'jane@example.com' },
          bill: expect.objectContaining({ total: 1200 }),
        }),
        'cnon:card',
      );
      expect(mocks.carBayRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ paymentId: 'payment-1' }),
      );
      expect(mocks.paymentRepository.capture).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'payment-1' }),
      );
      expect(mocks.carBayRepository.create.mock.invocationCallOrder[0]).toBeLessThan(
        mocks.paymentRepository.capture.mock.invocationCallOrder[0],
      );
    });

    it('charges the non-member rate when the customer has no membership', async () => {
      mocks.memberRepository.getAccessContextByEmail.mockResolvedValue(undefined);

      await sut.book(dto, NOW);

      expect(mocks.paymentRepository.authorize).toHaveBeenCalledWith(
        expect.objectContaining({ bill: expect.objectContaining({ total: 1800 }) }),
        'cnon:card',
      );
    });

    it('ignores a member claim the customer sends themselves', async () => {
      mocks.memberRepository.getAccessContextByEmail.mockResolvedValue(undefined);

      const booking = await sut.book({ ...dto, isMember: true } as typeof dto, NOW);

      expect(mocks.memberRepository.getAccessContextByEmail).toHaveBeenCalledWith(
        'jane@example.com',
      );
      expect(mocks.carBayRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ isMember: false }),
      );
      expect(booking.amountPaid).toBe(1800);
    });

    it('voids the authorization when another checkout took the slot first', async () => {
      mocks.carBayRepository.create.mockRejectedValue(new CarBaySlotTakenError());
      mocks.paymentRepository.void.mockResolvedValue(storedPayment());

      await expect(sut.book(dto, NOW)).rejects.toThrow(CarBaySlotTakenError);
      expect(mocks.paymentRepository.void).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'payment-1' }),
      );
      expect(mocks.paymentRepository.capture).not.toHaveBeenCalled();
    });

    it('releases the bay when the capture fails', async () => {
      mocks.paymentRepository.capture.mockRejectedValue(new PaymentDeclinedError());
      mocks.carBayRepository.update.mockResolvedValue(bookingRow({ status: 'canceled' }));

      await expect(sut.book(dto, NOW)).rejects.toThrow(CarBayRuleError);
      expect(mocks.carBayRepository.update).toHaveBeenCalledWith('booking-1', {
        status: 'canceled',
      });
    });

    it('turns a declined card into a readable error', async () => {
      mocks.paymentRepository.authorize.mockRejectedValue(new PaymentDeclinedError());

      await expect(sut.book(dto, NOW)).rejects.toThrow('Payment failed');
      await expect(sut.book(dto, NOW)).rejects.toThrow(CarBayRuleError);
      expect(mocks.carBayRepository.create).not.toHaveBeenCalled();
    });

    it('rejects a taken slot before touching the card', async () => {
      mocks.carBayRepository.getConfirmedInRange.mockResolvedValue([storedBooking()]);

      await expect(sut.book(dto, NOW)).rejects.toThrow(CarBaySlotTakenError);
      expect(mocks.paymentRepository.authorize).not.toHaveBeenCalled();
    });

    it('checks the 30 minute buffer when looking for conflicts', async () => {
      await sut.book(dto, NOW);

      const [, to] = mocks.carBayRepository.getConfirmedInRange.mock.calls[0];
      expect(to.toFormat('HH:mm')).toBe('18:00');
    });

    it('allows one Quick Job per customer per day', async () => {
      mocks.carBayRepository.hasConfirmedForCustomer.mockResolvedValue(true);

      await expect(sut.book(dto, NOW)).rejects.toThrow('one Quick Job');
      expect(mocks.paymentRepository.authorize).not.toHaveBeenCalled();
    });

    it('rejects public bookings more than 7 days out', async () => {
      const request = { ...QUICK_JOB, date: '2026-10-20' };

      await expect(sut.book({ ...dto, request }, NOW)).rejects.toThrow('7 days');
    });

    it('uses the booking rules saved in settings', async () => {
      stubCarBaySettings({ ...DEFAULT_CAR_BAY_POLICY, quickJobMinutes: 60, bufferMinutes: 15 });

      await sut.book(dto, NOW);

      expect(mocks.carBayRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          endAt: at(`${MONDAY}T17:00`),
          blockedUntil: at(`${MONDAY}T17:15`),
        }),
      );
    });

    it('sends a confirmation email', async () => {
      await sut.book(dto, NOW);

      await vi.waitFor(() =>
        expect(mocks.mailgunRepository.sendTemplate).toHaveBeenCalledWith(
          'jane@example.com',
          expect.any(String),
          expect.any(String),
          expect.any(String),
          'car_bay_booking',
          expect.objectContaining({ amountPaid: '12.00' }),
        ),
      );
    });
  });

  describe('staffBook', () => {
    beforeEach(() => {
      stubOpenSlot();
      stubCreateBooking();
    });

    it('books for free without charging Square', async () => {
      await sut.staffBook({ request: QUICK_JOB, ...CUSTOMER }, STAFF_EMAIL, NOW);

      expect(mocks.paymentRepository.authorize).not.toHaveBeenCalled();
      expect(mocks.carBayRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ createdByEmail: STAFF_EMAIL }),
      );
    });

    it('ignores the public booking horizon', async () => {
      const request = { ...QUICK_JOB, date: '2026-12-01' };

      await expect(
        sut.staffBook({ request, ...CUSTOMER }, STAFF_EMAIL, NOW),
      ).resolves.toBeDefined();
    });

    it('rejects a booking while the bay is closed', async () => {
      mocks.carBayRepository.getClosuresInRange.mockResolvedValue([
        factory.carBayClosure({ startAt: at(`${MONDAY}T16:00`), endAt: at(`${MONDAY}T21:00`) }),
      ]);

      await expect(
        sut.staffBook({ request: QUICK_JOB, ...CUSTOMER }, STAFF_EMAIL, NOW),
      ).rejects.toThrow('closed');
      expect(mocks.carBayRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('staffClose', () => {
    const CLOSURE = { date: MONDAY, startHour: 17, endHour: 19, reason: 'Lift inspection' };

    beforeEach(() => {
      mocks.carBayRepository.getConfirmedInRange.mockResolvedValue([]);
      mocks.carBayRepository.createClosure.mockImplementation(async (data) =>
        factory.carBayClosure(data),
      );
    });

    it('closes the bay without touching bookings', async () => {
      await sut.staffClose(CLOSURE, STAFF_EMAIL);

      expect(mocks.carBayRepository.createClosure).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'Lift inspection' }),
      );
    });

    it('refuses to close over a confirmed booking', async () => {
      mocks.carBayRepository.getConfirmedInRange.mockResolvedValue([storedBooking()]);

      await expect(sut.staffClose(CLOSURE, STAFF_EMAIL)).rejects.toThrow('Cancel the bookings');
      expect(mocks.carBayRepository.createClosure).not.toHaveBeenCalled();
    });
  });

  describe('cancelByToken', () => {
    beforeEach(() => {
      mocks.carBayRepository.getByToken.mockResolvedValue(storedBooking());
      mocks.carBayRepository.update.mockResolvedValue(bookingRow({ status: 'canceled' }));
      mocks.paymentRepository.refund.mockResolvedValue(true);
    });

    it('refunds in full 12 or more hours before the start', async () => {
      const result = await sut.cancelByToken('token-1', at(`${MONDAY}T04:00`));

      expect(mocks.paymentRepository.refund).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'payment-1' }),
      );
      expect(mocks.carBayRepository.update).toHaveBeenCalledWith('booking-1', {
        status: 'canceled',
      });
      expect(result.refunded).toBe(true);
    });

    it('cancels without a refund inside 12 hours', async () => {
      const result = await sut.cancelByToken('token-1', at(`${MONDAY}T10:00`));

      expect(mocks.paymentRepository.refund).not.toHaveBeenCalled();
      expect(mocks.carBayRepository.update).toHaveBeenCalledWith('booking-1', {
        status: 'canceled',
      });
      expect(result.refunded).toBe(false);
    });

    it('rejects a booking that is already canceled', async () => {
      mocks.carBayRepository.getByToken.mockResolvedValue(storedBooking({ status: 'canceled' }));

      await expect(sut.cancelByToken('token-1', NOW)).rejects.toThrow('no longer active');
    });
  });

  describe('staffCancel', () => {
    beforeEach(() => {
      mocks.carBayRepository.getById.mockResolvedValue(storedBooking());
      mocks.carBayRepository.update.mockResolvedValue(bookingRow({ status: 'canceled' }));
      mocks.paymentRepository.refund.mockResolvedValue(true);
    });

    it('refunds only when staff ask for it', async () => {
      await sut.staffCancel({ bookingId: 'booking-1', refund: false });
      expect(mocks.paymentRepository.refund).not.toHaveBeenCalled();

      await sut.staffCancel({ bookingId: 'booking-1', refund: true });
      expect(mocks.paymentRepository.refund).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'payment-1' }),
      );
    });

    it('has nothing to refund on a free staff booking', async () => {
      mocks.carBayRepository.getById.mockResolvedValue(
        storedBooking({ paymentId: null, payment: null }),
      );

      const result = await sut.staffCancel({ bookingId: 'booking-1', refund: true });

      expect(mocks.paymentRepository.refund).not.toHaveBeenCalled();
      expect(result.refunded).toBe(false);
    });
  });

  describe('markNoShow', () => {
    it('releases the bay without a refund', async () => {
      mocks.carBayRepository.getById.mockResolvedValue(storedBooking());
      mocks.carBayRepository.update.mockResolvedValue(bookingRow({ status: 'no_show' }));

      await sut.markNoShow('booking-1');

      expect(mocks.carBayRepository.update).toHaveBeenCalledWith('booking-1', {
        status: 'no_show',
      });
      expect(mocks.paymentRepository.refund).not.toHaveBeenCalled();
    });
  });

  describe('sendOverrunInvoice', () => {
    beforeEach(() => {
      mocks.carBayRepository.getById.mockResolvedValue(storedBooking());
      mocks.paymentRepository.save.mockImplementation(async (payment, id) =>
        savedPayment(payment, id),
      );
      mocks.carBayRepository.createOverrun.mockImplementation(async (bookingId, paymentId) =>
        factory.carBayOverrun({ bookingId, paymentId }),
      );
      mocks.mailgunRepository.sendTemplate.mockResolvedValue(undefined as never);
    });

    it('asks the customer to pay at the booking membership rate', async () => {
      mocks.carBayRepository.getById.mockResolvedValue(storedBooking({ isMember: false }));

      const payment = await sut.sendOverrunInvoice({
        bookingId: 'booking-1',
        overrun: { kind: 'hourly', hours: 2 },
      });

      expect(payment).toEqual(
        expect.objectContaining({
          type: 'car_bay_overrun',
          status: 'pending',
          total: 4000,
          lineItems: [expect.objectContaining({ quantity: 2 })],
          paymentUrl: `https://orion.example.com/pay/${payment.id}`,
        }),
      );
      expect(mocks.carBayRepository.createOverrun).toHaveBeenCalledWith('booking-1', payment.id);
      expect(mocks.mailgunRepository.sendTemplate).toHaveBeenCalledWith(
        'jane@example.com',
        expect.any(String),
        expect.any(String),
        expect.any(String),
        'payment_request',
        expect.objectContaining({
          total: '40.00',
          paymentUrl: `https://orion.example.com/pay/${payment.id}`,
        }),
      );
    });

    it('bills overnight stays and the days after the booking', async () => {
      const payment = await sut.sendOverrunInvoice({
        bookingId: 'booking-1',
        overrun: { kind: 'overnight', nights: 1, extraDays: 1 },
      });

      expect(payment.total).toBe(3000 + 2500);
    });
  });

  describe('sendDueReminders', () => {
    beforeEach(() => {
      mocks.mailgunRepository.sendTemplate.mockResolvedValue(undefined as never);
      mocks.carBayRepository.update.mockImplementation(async (id, updates) =>
        bookingRow({ id, ...(updates as Partial<CarBayBooking>) }),
      );
    });

    it('reminds bookings made more than 24 hours ahead and marks them sent', async () => {
      mocks.carBayRepository.getReminderCandidates.mockResolvedValue([
        storedBooking({ id: 'early', createdDate: NOW.minus({ days: 3 }) }),
        storedBooking({ id: 'late', createdDate: NOW }),
      ]);

      await sut.sendDueReminders(NOW);

      expect(mocks.mailgunRepository.sendTemplate).toHaveBeenCalledTimes(1);
      expect(mocks.carBayRepository.update).toHaveBeenCalledWith('early', {
        reminderSentDate: NOW,
      });
      expect(mocks.carBayRepository.update).not.toHaveBeenCalledWith('late', expect.anything());
    });

    it('looks 24 hours ahead', async () => {
      mocks.carBayRepository.getReminderCandidates.mockResolvedValue([]);

      await sut.sendDueReminders(NOW);

      expect(mocks.carBayRepository.getReminderCandidates).toHaveBeenCalledWith(
        NOW,
        NOW.plus({ hours: 24 }),
      );
    });
  });
});
