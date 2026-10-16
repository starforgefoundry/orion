import {
  CAR_BAY_ZONE,
  CarBaySlotTakenError,
  DEFAULT_CAR_BAY_POLICY,
  DEFAULT_CAR_BAY_RATES,
} from '$lib/utils/car_bay';
import { DateTime } from 'luxon';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

function storedBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: 'booking-1',
    tier: 'quick_job',
    status: 'confirmed',
    startAt: at(`${MONDAY}T16:00`),
    endAt: at(`${MONDAY}T17:30`),
    blockedUntil: at(`${MONDAY}T18:00`),
    ...CUSTOMER,
    amountPaid: 1200,
    squarePaymentId: 'pay-1',
    squareOrderId: 'order-1',
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
    };
    squareRepo = {
      upsertCustomer: vi.fn(async () => ({ id: 'cust-1' })),
      createOrder: vi.fn(async () => ({
        id: 'order-1',
        locationId: 'loc-1',
        customerId: 'cust-1',
      })),
      createPayment: vi.fn(async () => ({ id: 'pay-1', status: 'APPROVED' })),
      completePayment: vi.fn(async () => ({ id: 'pay-1', status: 'COMPLETED' })),
      cancelPayment: vi.fn(),
      refundPayment: vi.fn(),
      sendInvoice: vi.fn(async () => ({ publicUrl: 'https://square.link/inv' })),
    };
    paymentRepo = {
      createInvoice: vi.fn(async () => ({ id: 'inv-1', version: 1 })),
      createStandalonePayment: vi.fn(async (payment) => payment),
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

      expect(squareRepo.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          autocomplete: false,
          orderId: 'order-1',
          amountMoney: { amount: 1200n, currency: 'USD' },
        }),
      );
      expect(carBayRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ amountPaid: 1200, squarePaymentId: 'pay-1' }),
      );
      expect(squareRepo.completePayment).toHaveBeenCalledWith('pay-1');
      expect(carBayRepo.create.mock.invocationCallOrder[0]).toBeLessThan(
        squareRepo.completePayment.mock.invocationCallOrder[0],
      );
    });

    it('charges the non-member rate when the customer has no membership', async () => {
      memberRepo.getAccessContextByEmail.mockResolvedValue(undefined);
      await service.book(dto, NOW);

      expect(squareRepo.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({ amountMoney: { amount: 1800n, currency: 'USD' } }),
      );
    });

    it('ignores a member claim the customer sends themselves', async () => {
      memberRepo.getAccessContextByEmail.mockResolvedValue(undefined);
      await service.book({ ...dto, isMember: true } as typeof dto, NOW);

      expect(memberRepo.getAccessContextByEmail).toHaveBeenCalledWith('jane@example.com');
      expect(carBayRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ isMember: false, amountPaid: 1800 }),
      );
    });

    it('voids the authorization when another checkout took the slot first', async () => {
      carBayRepo.create.mockRejectedValue(new CarBaySlotTakenError());

      await expect(service.book(dto, NOW)).rejects.toThrow(CarBaySlotTakenError);
      expect(squareRepo.cancelPayment).toHaveBeenCalledWith('pay-1');
      expect(squareRepo.completePayment).not.toHaveBeenCalled();
    });

    it('releases the bay when the capture fails', async () => {
      squareRepo.completePayment.mockRejectedValue(new Error('capture failed'));

      await expect(service.book(dto, NOW)).rejects.toThrow('Payment failed');
      expect(carBayRepo.update).toHaveBeenCalledWith('booking-1', { status: 'canceled' });
      expect(squareRepo.cancelPayment).toHaveBeenCalledWith('pay-1');
    });

    it('turns a declined card into a readable error', async () => {
      squareRepo.createPayment.mockRejectedValue(new Error('CARD_DECLINED'));

      await expect(service.book(dto, NOW)).rejects.toThrow('Payment failed');
      expect(carBayRepo.create).not.toHaveBeenCalled();
    });

    it('rejects a taken slot before touching the card', async () => {
      carBayRepo.getConfirmedInRange.mockResolvedValue([storedBooking()]);

      await expect(service.book(dto, NOW)).rejects.toThrow(CarBaySlotTakenError);
      expect(squareRepo.createPayment).not.toHaveBeenCalled();
    });

    it('checks the 30 minute buffer when looking for conflicts', async () => {
      await service.book(dto, NOW);

      const [, to] = carBayRepo.getConfirmedInRange.mock.calls[0];
      expect(to.toFormat('HH:mm')).toBe('18:00');
    });

    it('allows one Quick Job per customer per day', async () => {
      carBayRepo.hasConfirmedForCustomer.mockResolvedValue(true);

      await expect(service.book(dto, NOW)).rejects.toThrow('one Quick Job');
      expect(squareRepo.createPayment).not.toHaveBeenCalled();
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

      expect(squareRepo.createPayment).not.toHaveBeenCalled();
      expect(carBayRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ amountPaid: 0, createdByEmail: 'staff@starforgefoundry.com' }),
      );
    });

    it('ignores the public booking horizon', async () => {
      const request = { ...QUICK_JOB, date: '2026-12-01' };

      await expect(
        service.staffBook({ request, ...CUSTOMER }, 'staff@starforgefoundry.com', NOW),
      ).resolves.toBeDefined();
    });
  });

  describe('cancelByToken', () => {
    it('refunds in full 12 or more hours before the start', async () => {
      const result = await service.cancelByToken('token-1', at(`${MONDAY}T04:00`));

      expect(squareRepo.refundPayment).toHaveBeenCalledWith('pay-1', 1200);
      expect(carBayRepo.update).toHaveBeenCalledWith('booking-1', { status: 'canceled' });
      expect(result.refunded).toBe(true);
    });

    it('cancels without a refund inside 12 hours', async () => {
      const result = await service.cancelByToken('token-1', at(`${MONDAY}T10:00`));

      expect(squareRepo.refundPayment).not.toHaveBeenCalled();
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
      expect(squareRepo.refundPayment).not.toHaveBeenCalled();

      await service.staffCancel({ bookingId: 'booking-1', refund: true });
      expect(squareRepo.refundPayment).toHaveBeenCalledWith('pay-1', 1200);
    });

    it('has nothing to refund on a free staff booking', async () => {
      carBayRepo.getById.mockResolvedValue(storedBooking({ amountPaid: 0, squarePaymentId: null }));

      const result = await service.staffCancel({ bookingId: 'booking-1', refund: true });

      expect(squareRepo.refundPayment).not.toHaveBeenCalled();
      expect(result.refunded).toBe(false);
    });
  });

  describe('markNoShow', () => {
    it('releases the bay without a refund', async () => {
      await service.markNoShow('booking-1');

      expect(carBayRepo.update).toHaveBeenCalledWith('booking-1', { status: 'no_show' });
      expect(squareRepo.refundPayment).not.toHaveBeenCalled();
    });
  });

  describe('sendOverrunInvoice', () => {
    it('sends a Square invoice at the booking membership rate', async () => {
      carBayRepo.getById.mockResolvedValue(storedBooking({ isMember: false }));

      const payment = await service.sendOverrunInvoice({
        bookingId: 'booking-1',
        overrun: { kind: 'hourly', hours: 2 },
      });

      expect(squareRepo.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          order: expect.objectContaining({
            lineItems: [expect.objectContaining({ quantity: '2' })],
          }),
        }),
      );
      expect(squareRepo.sendInvoice).toHaveBeenCalledWith('inv-1', 1);
      expect(payment).toEqual(
        expect.objectContaining({
          type: 'car_bay_overrun',
          status: 'pending',
          total: 4000,
          squareInvoiceId: 'inv-1',
          carBayBookingId: 'booking-1',
          paymentUrl: 'https://square.link/inv',
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
