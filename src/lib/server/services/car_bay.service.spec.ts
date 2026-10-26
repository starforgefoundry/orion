import {
  CAR_BAY_ZONE,
  CarBayRuleError,
  CarBaySlotTakenError,
  DEFAULT_CAR_BAY_POLICY,
  DEFAULT_CAR_BAY_RATES,
} from '$lib/utils/car_bay';
import { DateTime } from 'luxon';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentDeclinedError } from '$lib/server/repositories/payment.repository';
import { CarBayService } from './car_bay.service';

vi.mock('$env/dynamic/private', () => ({
  env: { FRONTEND_URL: 'https://example.com' },
}));

// 2026-10-12 is a Monday.
const MONDAY = '2026-10-12';
const NOW = DateTime.fromISO(`${MONDAY}T09:00`, { zone: CAR_BAY_ZONE });

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

function storedPayment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'payment-1',
    type: 'car_bay_booking',
    status: 'paid',
    total: 1200,
    squarePaymentId: 'pay-1',
    lineItems: [],
    discounts: [],
    ...overrides,
  };
}

function storedBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: 'booking-1',
    tier: 'quick_job',
    status: 'confirmed',
    startAt: at(`${MONDAY}T16:00`),
    endAt: at(`${MONDAY}T17:30`),
    blockedUntil: at(`${MONDAY}T18:00`),
    ...CUSTOMER,
    paymentId: 'payment-1',
    payment: storedPayment(),
    createdByEmail: null,
    bookingToken: 'token-1',
    reminderSentDate: null,
    createdDate: NOW.minus({ days: 2 }),
    ...overrides,
  };
}

describe('CarBayService', () => {
  let service: CarBayService;
  let carBayRepo: any;
  let squareRepo: any;
  let memberRepo: any;
  let paymentRepo: any;
  let settingsRepo: any;
  let mailgunRepo: any;

  beforeEach(() => {
    carBayRepo = {
      create: vi.fn(async (data) => storedBooking(data)),
      update: vi.fn(async (id, updates) => storedBooking({ id, ...updates })),
      getById: vi.fn(async () => storedBooking()),
      getByToken: vi.fn(async () => storedBooking()),
      getConfirmedInRange: vi.fn(async () => []),
      getAllInRange: vi.fn(async () => []),
      hasConfirmedForCustomer: vi.fn(async () => false),
      getReminderCandidates: vi.fn(async () => []),
      getOverrunPayments: vi.fn(async () => []),
      createOverrun: vi.fn(),
      getClosuresInRange: vi.fn(async () => []),
      createClosure: vi.fn(async (data) => ({ id: 'closure-1', reason: null, ...data })),
      deleteClosure: vi.fn(async () => null),
    };
    squareRepo = {};
    paymentRepo = {
      authorize: vi.fn(async (payment) =>
        storedPayment({ status: 'pending', total: payment.bill.total }),
      ),
      capture: vi.fn(async (payment) => ({ ...payment, status: 'paid' })),
      void: vi.fn(),
      refund: vi.fn(async () => true),
      save: vi.fn(async (payment, id) => ({
        id,
        type: payment.type,
        status: payment.status,
        total: payment.bill.total,
        lineItems: payment.bill.lineItems,
        paymentUrl: payment.paymentUrl,
      })),
    };
    settingsRepo = {
      getSetting: vi.fn(
        async (key: string) =>
          ({ carBayRates: DEFAULT_CAR_BAY_RATES, carBayPolicy: DEFAULT_CAR_BAY_POLICY })[key] ?? {
            locationId: 'loc-1',
          },
      ),
    };
    mailgunRepo = { sendTemplate: vi.fn() };
    memberRepo = {
      getAccessContextByEmail: vi.fn(async () => ({
        subscriptions: [{ status: 'active', accessEndedDate: null }],
        organizations: [],
        dayPasses: [],
      })),
    };

    service = new CarBayService(
      undefined,
      undefined,
      undefined,
      paymentRepo,
      settingsRepo,
      squareRepo,
      mailgunRepo,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      carBayRepo,
      { memberRepository: memberRepo },
    );
  });

  describe('book', () => {
    const dto = { request: QUICK_JOB, ...CUSTOMER, sourceId: 'cnon:card' };

    it('authorizes the card, holds the bay, then captures the payment', async () => {
      await service.book(dto, NOW);

      expect(paymentRepo.authorize).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'car_bay_booking',
          customer: { name: 'Jane Doe', email: 'jane@example.com' },
          bill: expect.objectContaining({ total: 1200 }),
        }),
        'cnon:card',
      );
      expect(carBayRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ paymentId: 'payment-1' }),
      );
      expect(paymentRepo.capture).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'payment-1' }),
      );
      expect(carBayRepo.create.mock.invocationCallOrder[0]).toBeLessThan(
        paymentRepo.capture.mock.invocationCallOrder[0],
      );
    });

    it('charges the non-member rate when the customer has no membership', async () => {
      memberRepo.getAccessContextByEmail.mockResolvedValue(undefined);
      await service.book(dto, NOW);

      expect(paymentRepo.authorize).toHaveBeenCalledWith(
        expect.objectContaining({ bill: expect.objectContaining({ total: 1800 }) }),
        'cnon:card',
      );
    });

    it('ignores a member claim the customer sends themselves', async () => {
      memberRepo.getAccessContextByEmail.mockResolvedValue(undefined);
      const booking = await service.book({ ...dto, isMember: true } as typeof dto, NOW);

      expect(memberRepo.getAccessContextByEmail).toHaveBeenCalledWith('jane@example.com');
      expect(carBayRepo.create).toHaveBeenCalledWith(expect.objectContaining({ isMember: false }));
      expect(booking.amountPaid).toBe(1800);
    });

    it('voids the authorization when another checkout took the slot first', async () => {
      carBayRepo.create.mockRejectedValue(new CarBaySlotTakenError());

      await expect(service.book(dto, NOW)).rejects.toThrow(CarBaySlotTakenError);
      expect(paymentRepo.void).toHaveBeenCalledWith(expect.objectContaining({ id: 'payment-1' }));
      expect(paymentRepo.capture).not.toHaveBeenCalled();
    });

    it('releases the bay when the capture fails', async () => {
      paymentRepo.capture.mockRejectedValue(new PaymentDeclinedError());

      await expect(service.book(dto, NOW)).rejects.toThrow(CarBayRuleError);
      expect(carBayRepo.update).toHaveBeenCalledWith('booking-1', { status: 'canceled' });
    });

    it('turns a declined card into a readable error', async () => {
      paymentRepo.authorize.mockRejectedValue(new PaymentDeclinedError());

      await expect(service.book(dto, NOW)).rejects.toThrow('Payment failed');
      await expect(service.book(dto, NOW)).rejects.toThrow(CarBayRuleError);
      expect(carBayRepo.create).not.toHaveBeenCalled();
    });

    it('rejects a taken slot before touching the card', async () => {
      carBayRepo.getConfirmedInRange.mockResolvedValue([storedBooking()]);

      await expect(service.book(dto, NOW)).rejects.toThrow(CarBaySlotTakenError);
      expect(paymentRepo.authorize).not.toHaveBeenCalled();
    });

    it('checks the 30 minute buffer when looking for conflicts', async () => {
      await service.book(dto, NOW);

      const [, to] = carBayRepo.getConfirmedInRange.mock.calls[0];
      expect(to.toFormat('HH:mm')).toBe('18:00');
    });

    it('allows one Quick Job per customer per day', async () => {
      carBayRepo.hasConfirmedForCustomer.mockResolvedValue(true);

      await expect(service.book(dto, NOW)).rejects.toThrow('one Quick Job');
      expect(paymentRepo.authorize).not.toHaveBeenCalled();
    });

    it('rejects public bookings more than 7 days out', async () => {
      const request = { ...QUICK_JOB, date: '2026-10-20' };

      await expect(service.book({ ...dto, request }, NOW)).rejects.toThrow('7 days');
    });

    it('uses the booking rules saved in settings', async () => {
      settingsRepo.getSetting.mockImplementation(async (key: string) =>
        key === 'carBayPolicy'
          ? { ...DEFAULT_CAR_BAY_POLICY, quickJobMinutes: 60, bufferMinutes: 15 }
          : key === 'carBayRates'
            ? DEFAULT_CAR_BAY_RATES
            : { locationId: 'loc-1' },
      );

      await service.book(dto, NOW);

      expect(carBayRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          endAt: at(`${MONDAY}T17:00`),
          blockedUntil: at(`${MONDAY}T17:15`),
        }),
      );
    });

    it('sends a confirmation email', async () => {
      await service.book(dto, NOW);
      await vi.waitFor(() =>
        expect(mailgunRepo.sendTemplate).toHaveBeenCalledWith(
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
    it('books for free without charging Square', async () => {
      await service.staffBook(
        { request: QUICK_JOB, ...CUSTOMER },
        'staff@starforgefoundry.com',
        NOW,
      );

      expect(paymentRepo.authorize).not.toHaveBeenCalled();
      expect(carBayRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ createdByEmail: 'staff@starforgefoundry.com' }),
      );
    });

    it('ignores the public booking horizon', async () => {
      const request = { ...QUICK_JOB, date: '2026-12-01' };

      await expect(
        service.staffBook({ request, ...CUSTOMER }, 'staff@starforgefoundry.com', NOW),
      ).resolves.toBeDefined();
    });

    it('rejects a booking while the bay is closed', async () => {
      carBayRepo.getClosuresInRange.mockResolvedValue([
        { id: 'closure-1', startAt: at(`${MONDAY}T16:00`), endAt: at(`${MONDAY}T21:00`) },
      ]);

      await expect(
        service.staffBook({ request: QUICK_JOB, ...CUSTOMER }, 'staff@starforgefoundry.com', NOW),
      ).rejects.toThrow('closed');
      expect(carBayRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('staffClose', () => {
    const CLOSURE = { date: MONDAY, startHour: 17, endHour: 19, reason: 'Lift inspection' };

    it('closes the bay without touching bookings', async () => {
      await service.staffClose(CLOSURE, 'staff@starforgefoundry.com');

      expect(carBayRepo.createClosure).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'Lift inspection' }),
      );
    });

    it('refuses to close over a confirmed booking', async () => {
      carBayRepo.getConfirmedInRange.mockResolvedValue([storedBooking()]);

      await expect(service.staffClose(CLOSURE, 'staff@starforgefoundry.com')).rejects.toThrow(
        'Cancel the bookings',
      );
      expect(carBayRepo.createClosure).not.toHaveBeenCalled();
    });
  });

  describe('cancelByToken', () => {
    it('refunds in full 12 or more hours before the start', async () => {
      const result = await service.cancelByToken('token-1', at(`${MONDAY}T04:00`));

      expect(paymentRepo.refund).toHaveBeenCalledWith(expect.objectContaining({ id: 'payment-1' }));
      expect(carBayRepo.update).toHaveBeenCalledWith('booking-1', { status: 'canceled' });
      expect(result.refunded).toBe(true);
    });

    it('cancels without a refund inside 12 hours', async () => {
      const result = await service.cancelByToken('token-1', at(`${MONDAY}T10:00`));

      expect(paymentRepo.refund).not.toHaveBeenCalled();
      expect(carBayRepo.update).toHaveBeenCalledWith('booking-1', { status: 'canceled' });
      expect(result.refunded).toBe(false);
    });

    it('rejects a booking that is already canceled', async () => {
      carBayRepo.getByToken.mockResolvedValue(storedBooking({ status: 'canceled' }));

      await expect(service.cancelByToken('token-1', NOW)).rejects.toThrow('no longer active');
    });
  });

  describe('staffCancel', () => {
    it('refunds only when staff ask for it', async () => {
      await service.staffCancel({ bookingId: 'booking-1', refund: false });
      expect(paymentRepo.refund).not.toHaveBeenCalled();

      await service.staffCancel({ bookingId: 'booking-1', refund: true });
      expect(paymentRepo.refund).toHaveBeenCalledWith(expect.objectContaining({ id: 'payment-1' }));
    });

    it('has nothing to refund on a free staff booking', async () => {
      carBayRepo.getById.mockResolvedValue(storedBooking({ paymentId: null, payment: null }));

      const result = await service.staffCancel({ bookingId: 'booking-1', refund: true });

      expect(paymentRepo.refund).not.toHaveBeenCalled();
      expect(result.refunded).toBe(false);
    });
  });

  describe('markNoShow', () => {
    it('releases the bay without a refund', async () => {
      await service.markNoShow('booking-1');

      expect(carBayRepo.update).toHaveBeenCalledWith('booking-1', { status: 'no_show' });
      expect(paymentRepo.refund).not.toHaveBeenCalled();
    });
  });

  describe('sendOverrunInvoice', () => {
    it('asks the customer to pay at the booking membership rate', async () => {
      carBayRepo.getById.mockResolvedValue(storedBooking({ isMember: false }));

      const payment = await service.sendOverrunInvoice({
        bookingId: 'booking-1',
        overrun: { kind: 'hourly', hours: 2 },
      });

      expect(payment).toEqual(
        expect.objectContaining({
          type: 'car_bay_overrun',
          status: 'pending',
          total: 4000,
          lineItems: [expect.objectContaining({ quantity: 2 })],
          paymentUrl: `https://example.com/pay/${payment.id}`,
        }),
      );
      expect(carBayRepo.createOverrun).toHaveBeenCalledWith('booking-1', payment.id);
      expect(mailgunRepo.sendTemplate).toHaveBeenCalledWith(
        'jane@example.com',
        expect.any(String),
        expect.any(String),
        expect.any(String),
        'payment_request',
        expect.objectContaining({
          total: '40.00',
          paymentUrl: `https://example.com/pay/${payment.id}`,
        }),
      );
    });

    it('bills overnight stays and the days after the booking', async () => {
      const payment = await service.sendOverrunInvoice({
        bookingId: 'booking-1',
        overrun: { kind: 'overnight', nights: 1, extraDays: 1 },
      });

      expect(payment.total).toBe(3000 + 2500);
    });
  });

  describe('sendDueReminders', () => {
    it('reminds bookings made more than 24 hours ahead and marks them sent', async () => {
      carBayRepo.getReminderCandidates.mockResolvedValue([
        storedBooking({ id: 'early', createdDate: NOW.minus({ days: 3 }) }),
        storedBooking({ id: 'late', createdDate: NOW }),
      ]);

      await service.sendDueReminders(NOW);

      expect(mailgunRepo.sendTemplate).toHaveBeenCalledTimes(1);
      expect(carBayRepo.update).toHaveBeenCalledWith('early', { reminderSentDate: NOW });
      expect(carBayRepo.update).not.toHaveBeenCalledWith('late', expect.anything());
    });

    it('looks 24 hours ahead', async () => {
      await service.sendDueReminders(NOW);

      expect(carBayRepo.getReminderCandidates).toHaveBeenCalledWith(NOW, NOW.plus({ hours: 24 }));
    });
  });
});
