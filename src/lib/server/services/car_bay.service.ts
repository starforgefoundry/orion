import { env } from '$env/dynamic/private';
import type {
  BookCarBayDto,
  CarBayBookingDetail,
  CarBayBookingView,
  CustomerCarBayBooking,
  PublicCarBaySchedule,
  SendCarBayOverrunInvoiceDto,
  StaffBookCarBayDto,
  StaffCancelCarBayBookingDto,
} from '$lib/remotes/dtos/car_bay.dto';
import type { CarBayBooking } from '$lib/server/db/schema';
import { BaseService } from '$lib/server/services/base.service';
import { runInBackground } from '$lib/server/utils/background';
import {
  SQUARE_CURRENCY,
  hasActiveMembership,
  stringifySquareObject,
} from '$lib/server/utils/square';
import {
  CAR_BAY_PUBLIC_HORIZON_DAYS,
  CAR_BAY_REMINDER_LEAD_HOURS,
  CAR_BAY_STATUS,
  CAR_BAY_TIER,
  CAR_BAY_TIER_NAMES,
  CAR_BAY_ZONE,
  CarBayRuleError,
  CarBaySlotTakenError,
  CENTS_PER_DOLLAR,
  blockedUntil,
  bookingLineItems,
  formatPeriod,
  isRefundable,
  lineItemsTotal,
  needsReminder,
  overrunLineItems,
  resolvePeriod,
  type CarBayLineItem,
  type CarBayRequest,
} from '$lib/utils/car_bay';
import { DateTime } from 'luxon';
import type { OrderLineItem } from 'square';

const CAR_BAY_EMAIL = 'carbay@starforgefoundry.com';
const CAR_BAY_SENDER = `Starforge Car Bay <${CAR_BAY_EMAIL}>`;
const APPROVED_PAYMENT_STATUS = 'APPROVED';
const OVERRUN_PAYMENT_TYPE = 'car_bay_overrun';
const PAYMENT_FAILED_MESSAGE = 'Payment failed. Please check your card details and try again.';

type CustomerDetails = Pick<
  StaffBookCarBayDto,
  'customerName' | 'customerEmail' | 'customerPhone' | 'isMember'
>;

function toSquareLineItem(item: CarBayLineItem): OrderLineItem {
  return {
    name: item.name,
    quantity: item.quantity.toString(),
    basePriceMoney: { amount: BigInt(item.unitAmount), currency: SQUARE_CURRENCY },
  };
}

function toView(booking: CarBayBooking): CarBayBookingView {
  const { startAt, endAt, blockedUntil, createdDate, reminderSentDate, ...rest } = booking;
  return {
    ...rest,
    startAt: startAt.toISO()!,
    endAt: endAt.toISO()!,
    createdDate: createdDate.toISO()!,
  };
}

function formatCents(cents: number) {
  return (cents / CENTS_PER_DOLLAR).toFixed(2);
}

export class CarBayService extends BaseService {
  async getPublicSchedule(now: DateTime = DateTime.now()): Promise<PublicCarBaySchedule> {
    const from = now.setZone(CAR_BAY_ZONE).startOf('day');
    const to = from.plus({ days: CAR_BAY_PUBLIC_HORIZON_DAYS + 1 });
    const bookings = await this.carBayRepository.getConfirmedInRange(from, to);

    return {
      today: from.toISODate()!,
      bookings: bookings.map((booking) => ({
        id: booking.id,
        startAt: booking.startAt.toISO()!,
        endAt: booking.endAt.toISO()!,
      })),
    };
  }

  async getStaffSchedule(fromDate: string, toDate: string) {
    const from = DateTime.fromISO(fromDate, { zone: CAR_BAY_ZONE }).startOf('day');
    const to = DateTime.fromISO(toDate, { zone: CAR_BAY_ZONE }).endOf('day');
    const bookings = await this.carBayRepository.getAllInRange(from, to);
    return bookings.map(toView);
  }

  async getBookingDetail(
    id: string,
    now: DateTime = DateTime.now(),
  ): Promise<CarBayBookingDetail | null> {
    const booking = await this.carBayRepository.getById(id);
    if (!booking) return null;

    const payments = await this.carBayRepository.getOverrunPayments(id);
    return {
      ...toView(booking),
      refundable: isRefundable(booking.startAt, now),
      overrunInvoices: payments.map((payment) => ({
        id: payment.id,
        status: payment.status,
        total: payment.total,
        paymentUrl: payment.paymentUrl,
        issuedDate: payment.issuedDate.toISO()!,
      })),
    };
  }

  async getBookingByToken(
    token: string,
    now: DateTime = DateTime.now(),
  ): Promise<CustomerCarBayBooking | null> {
    const booking = await this.carBayRepository.getByToken(token);
    if (!booking) return null;

    return {
      id: booking.id,
      tier: booking.tier,
      status: booking.status,
      startAt: booking.startAt.toISO()!,
      endAt: booking.endAt.toISO()!,
      customerName: booking.customerName,
      customerEmail: booking.customerEmail,
      amountPaid: booking.amountPaid,
      refundable: isRefundable(booking.startAt, now),
    };
  }

  private async validateRequest(
    request: CarBayRequest,
    customerEmail: string,
    now: DateTime,
    options: { enforceHorizon: boolean },
  ) {
    const period = resolvePeriod(request, now, options);

    if (request.tier === CAR_BAY_TIER.QUICK_JOB) {
      const day = period.startAt.startOf('day');
      const hasQuickJob = await this.carBayRepository.hasConfirmedForCustomer(
        customerEmail,
        CAR_BAY_TIER.QUICK_JOB,
        day,
        day.plus({ days: 1 }),
      );
      if (hasQuickJob) {
        throw new CarBayRuleError(
          'Only one Quick Job can be booked per day. Book the Hourly tier if you need more time.',
        );
      }
    }

    const overlapping = await this.carBayRepository.getConfirmedInRange(
      period.startAt,
      blockedUntil(period.endAt),
    );
    if (overlapping.length > 0) throw new CarBaySlotTakenError();

    return period;
  }

  async isMember(customerEmail: string) {
    return hasActiveMembership(await this.squareRepository.getMembershipsByEmail(customerEmail));
  }

  async book(dto: BookCarBayDto, now: DateTime = DateTime.now()) {
    const period = await this.validateRequest(dto.request, dto.customerEmail, now, {
      enforceHorizon: true,
    });

    const [rates, squareSettings, isMember] = await Promise.all([
      this.settingsRepository.getSetting('carBayRates'),
      this.settingsRepository.getSetting('printRequestSquare'),
      this.isMember(dto.customerEmail),
    ]);
    const lineItems = bookingLineItems(dto.request, rates, isMember);
    const total = lineItemsTotal(lineItems);

    const customer = await this.squareRepository.upsertCustomer(
      dto.customerName,
      dto.customerEmail,
    );
    const order = await this.squareRepository.createOrder({
      idempotencyKey: crypto.randomUUID(),
      order: {
        locationId: squareSettings.locationId,
        customerId: customer.id,
        lineItems: lineItems.map(toSquareLineItem),
      },
    });
    if (!order?.id) throw new Error('Failed to create order in Square');

    // Only authorize the card here so a losing checkout can be voided instead of refunded.
    const payment = await this.squareRepository
      .createPayment({
        sourceId: dto.sourceId,
        idempotencyKey: crypto.randomUUID(),
        amountMoney: { amount: BigInt(total), currency: SQUARE_CURRENCY },
        orderId: order.id,
        locationId: squareSettings.locationId,
        customerId: customer.id,
        buyerEmailAddress: dto.customerEmail,
        autocomplete: false,
      })
      .catch((error) => {
        throw new CarBayRuleError(PAYMENT_FAILED_MESSAGE, { cause: error });
      });
    if (!payment?.id || payment.status !== APPROVED_PAYMENT_STATUS) {
      throw new CarBayRuleError(PAYMENT_FAILED_MESSAGE);
    }

    let booking: CarBayBooking;
    try {
      booking = await this.carBayRepository.create({
        tier: dto.request.tier,
        status: CAR_BAY_STATUS.CONFIRMED,
        startAt: period.startAt,
        endAt: period.endAt,
        blockedUntil: blockedUntil(period.endAt),
        ...this.customerColumns({ ...dto, isMember }),
        amountPaid: total,
        squarePaymentId: payment.id,
        squareOrderId: order.id,
      });
    } catch (error) {
      await this.squareRepository.cancelPayment(payment.id);
      throw error;
    }

    try {
      await this.squareRepository.completePayment(payment.id);
    } catch (error) {
      await this.carBayRepository.update(booking.id, { status: CAR_BAY_STATUS.CANCELED });
      await this.squareRepository.cancelPayment(payment.id);
      throw new CarBayRuleError(PAYMENT_FAILED_MESSAGE, { cause: error });
    }

    runInBackground(this.sendConfirmationEmail(booking), 'send car bay booking email');
    return toView(booking);
  }

  async staffBook(dto: StaffBookCarBayDto, staffEmail: string, now: DateTime = DateTime.now()) {
    const period = await this.validateRequest(dto.request, dto.customerEmail, now, {
      enforceHorizon: false,
    });

    const booking = await this.carBayRepository.create({
      tier: dto.request.tier,
      status: CAR_BAY_STATUS.CONFIRMED,
      startAt: period.startAt,
      endAt: period.endAt,
      blockedUntil: blockedUntil(period.endAt),
      ...this.customerColumns(dto),
      amountPaid: 0,
      createdByEmail: staffEmail,
    });

    runInBackground(this.sendConfirmationEmail(booking), 'send car bay booking email');
    return toView(booking);
  }

  private customerColumns(dto: CustomerDetails) {
    return {
      isMember: dto.isMember,
      customerName: dto.customerName,
      customerEmail: dto.customerEmail,
      customerPhone: dto.customerPhone,
    };
  }

  private async refund(booking: CarBayBooking) {
    if (!booking.squarePaymentId || booking.amountPaid <= 0) return false;
    await this.squareRepository.refundPayment(booking.squarePaymentId, booking.amountPaid);
    return true;
  }

  private requireConfirmed(booking: CarBayBooking | null): CarBayBooking {
    if (!booking) throw new CarBayRuleError('Booking not found');
    if (booking.status !== CAR_BAY_STATUS.CONFIRMED)
      throw new CarBayRuleError('This booking is no longer active');
    return booking;
  }

  async cancelByToken(token: string, now: DateTime = DateTime.now()) {
    const booking = this.requireConfirmed(await this.carBayRepository.getByToken(token));
    const refunded = isRefundable(booking.startAt, now) && (await this.refund(booking));

    await this.carBayRepository.update(booking.id, { status: CAR_BAY_STATUS.CANCELED });
    return { refunded };
  }

  async staffCancel(dto: StaffCancelCarBayBookingDto) {
    const booking = this.requireConfirmed(await this.carBayRepository.getById(dto.bookingId));
    const refunded = dto.refund && (await this.refund(booking));

    await this.carBayRepository.update(booking.id, { status: CAR_BAY_STATUS.CANCELED });
    return { refunded };
  }

  async markNoShow(bookingId: string) {
    const booking = this.requireConfirmed(await this.carBayRepository.getById(bookingId));
    return toView(
      await this.carBayRepository.update(booking.id, { status: CAR_BAY_STATUS.NO_SHOW }),
    );
  }

  async sendOverrunInvoice(dto: SendCarBayOverrunInvoiceDto) {
    const booking = this.requireConfirmed(await this.carBayRepository.getById(dto.bookingId));

    const [rates, squareSettings] = await Promise.all([
      this.settingsRepository.getSetting('carBayRates'),
      this.settingsRepository.getSetting('printRequestSquare'),
    ]);
    const lineItems = overrunLineItems(
      dto.overrun,
      booking.endAt.toISODate()!,
      rates,
      booking.isMember,
    );

    const customer = await this.squareRepository.upsertCustomer(
      booking.customerName,
      booking.customerEmail,
    );
    const order = await this.squareRepository.createOrder({
      idempotencyKey: crypto.randomUUID(),
      order: {
        locationId: squareSettings.locationId,
        customerId: customer.id,
        lineItems: lineItems.map(toSquareLineItem),
      },
    });
    if (!order) throw new Error('Failed to create order in Square');

    const invoice = await this.paymentRepository.createInvoice(order);
    if (!invoice) throw new Error('Failed to create invoice in Square');

    const published = await this.squareRepository.sendInvoice(invoice.id!, invoice.version!);

    return await this.paymentRepository.createStandalonePayment({
      type: OVERRUN_PAYMENT_TYPE,
      status: 'pending',
      issuedDate: DateTime.now(),
      total: lineItemsTotal(lineItems),
      squareInvoiceId: invoice.id!,
      squareOrderId: order.id!,
      orderObject: stringifySquareObject(order),
      paymentUrl: published?.publicUrl ?? null,
      carBayBookingId: booking.id,
    });
  }

  async sendDueReminders(now: DateTime = DateTime.now()) {
    const candidates = await this.carBayRepository.getReminderCandidates(
      now,
      now.plus({ hours: CAR_BAY_REMINDER_LEAD_HOURS }),
    );

    for (const booking of candidates.filter((b) => needsReminder(b.createdDate, b.startAt))) {
      try {
        await this.mailgunRepository.sendTemplate(
          booking.customerEmail,
          CAR_BAY_SENDER,
          CAR_BAY_EMAIL,
          'Car Bay Booking Reminder',
          'car_bay_reminder',
          {
            customerName: booking.customerName,
            tierName: CAR_BAY_TIER_NAMES[booking.tier],
            bookingWhen: formatPeriod(booking),
            bookingUrl: this.bookingUrl(booking),
          },
        );
        await this.carBayRepository.update(booking.id, { reminderSentDate: now });
      } catch (error) {
        console.error(`Failed to send car bay reminder for booking ${booking.id}:`, error);
      }
    }
  }

  private bookingUrl(booking: CarBayBooking) {
    return `${env.FRONTEND_URL}/car_bay/booking/${booking.bookingToken}`;
  }

  async sendConfirmationEmail(booking: CarBayBooking) {
    await this.mailgunRepository.sendTemplate(
      booking.customerEmail,
      CAR_BAY_SENDER,
      CAR_BAY_EMAIL,
      `Car Bay Booking Confirmation - ${CAR_BAY_TIER_NAMES[booking.tier]}`,
      'car_bay_booking',
      {
        customerName: booking.customerName,
        tierName: CAR_BAY_TIER_NAMES[booking.tier],
        bookingWhen: formatPeriod(booking),
        amountPaid: formatCents(booking.amountPaid),
        bookingUrl: this.bookingUrl(booking),
      },
    );
  }
}

export const carBayService = new CarBayService();
