import { env } from '$env/dynamic/private';
import type {
  BookCarBayDto,
  CarBayBookingDetail,
  CarBayBookingView,
  CarBayClosureView,
  CarBayStaffSchedule,
  CustomerCarBayBooking,
  PublicCarBaySchedule,
  SendCarBayOverrunInvoiceDto,
  StaffBookCarBayDto,
  StaffCancelCarBayBookingDto,
  StaffCloseCarBayDto,
} from '$lib/remotes/dtos/car_bay.dto';
import type { CarBayBooking, CarBayClosure, Payment } from '$lib/server/db/schema';
import type { CarBayBookingWithPayment } from '$lib/server/repositories/car_bay.repository';
import { PaymentDeclinedError } from '$lib/server/repositories/payment.repository';
import { BaseService } from '$lib/server/services/base.service';
import { runInBackground } from '$lib/server/utils/background';
import { hasMembership } from '$lib/server/utils/member_access';
import { passLinks } from '$lib/server/utils/member_links';
import { payUrl } from '$lib/server/utils/payment_links';
import {
  amountPaid,
  buildBill,
  centsToDollars,
  PAYMENT_STATUS,
  PAYMENT_TYPE,
} from '$lib/utils/billing';
import {
  CAR_BAY_EMAIL,
  CAR_BAY_STATUS,
  CAR_BAY_TIER,
  CAR_BAY_TIER_NAMES,
  CAR_BAY_ZONE,
  CarBayRuleError,
  CarBayRules,
  CarBaySlotTakenError,
  bookingLineItems,
  formatPeriod,
  overrunLineItems,
  type CarBayPolicy,
  type CarBayRequest,
} from '$lib/utils/car_bay';
import { DateTime } from 'luxon';

const CAR_BAY_SENDER = `Starforge Car Bay <${CAR_BAY_EMAIL}>`;
const CLOSED_MESSAGE = 'The bay is closed at that time. Please pick another time.';

type CustomerDetails = Pick<
  StaffBookCarBayDto,
  'customerName' | 'customerEmail' | 'customerPhone' | 'isMember'
>;

function toView(booking: CarBayBooking, payment: Payment | null): CarBayBookingView {
  const { startAt, endAt, blockedUntil, createdDate, reminderSentDate, ...rest } = booking;
  return {
    ...rest,
    startAt: startAt.toISO()!,
    endAt: endAt.toISO()!,
    blockedUntil: blockedUntil.toISO()!,
    createdDate: createdDate.toISO()!,
    amountPaid: amountPaid(payment),
  };
}

function toPaymentError(error: unknown): never {
  if (error instanceof PaymentDeclinedError) {
    throw new CarBayRuleError(error.message, { cause: error });
  }
  throw error;
}

function toClosureView(closure: CarBayClosure): CarBayClosureView {
  return {
    id: closure.id,
    startAt: closure.startAt.toISO()!,
    endAt: closure.endAt.toISO()!,
    reason: closure.reason,
  };
}

export class CarBayService extends BaseService {
  private async rules() {
    return new CarBayRules(await this.settingsRepository.getSetting('carBayPolicy'));
  }
  async getPublicSchedule(now: DateTime = DateTime.now()): Promise<PublicCarBaySchedule> {
    const rules = await this.rules();
    const from = now.setZone(CAR_BAY_ZONE).startOf('day');
    const to = from.plus({ days: rules.policy.publicHorizonDays + 1 });
    const [bookings, closures] = await Promise.all([
      this.carBayRepository.getConfirmedInRange(from, to),
      this.carBayRepository.getClosuresInRange(from, to),
    ]);

    return {
      today: from.toISODate()!,
      bookings: bookings.map((booking) => ({
        id: booking.id,
        startAt: booking.startAt.toISO()!,
        endAt: booking.endAt.toISO()!,
        blockedUntil: booking.blockedUntil.toISO()!,
      })),
      closures: closures.map(({ id, startAt, endAt }) => ({
        id,
        startAt: startAt.toISO()!,
        endAt: endAt.toISO()!,
      })),
    };
  }

  async getStaffSchedule(fromDate: string, toDate: string): Promise<CarBayStaffSchedule> {
    const from = DateTime.fromISO(fromDate, { zone: CAR_BAY_ZONE }).startOf('day');
    const to = DateTime.fromISO(toDate, { zone: CAR_BAY_ZONE }).endOf('day');
    const [bookings, closures] = await Promise.all([
      this.carBayRepository.getAllInRange(from, to),
      this.carBayRepository.getClosuresInRange(from, to),
    ]);
    return {
      bookings: bookings.map((booking) => toView(booking, booking.payment)),
      closures: closures.map(toClosureView),
    };
  }

  async getBookingDetail(
    id: string,
    now: DateTime = DateTime.now(),
  ): Promise<CarBayBookingDetail | null> {
    const rules = await this.rules();
    const booking = await this.carBayRepository.getById(id);
    if (!booking) return null;

    const payments = await this.carBayRepository.getOverrunPayments(id);
    return {
      ...toView(booking, booking.payment),
      refundable: rules.isRefundable(booking.startAt, now),
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
    const rules = await this.rules();
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
      amountPaid: amountPaid(booking.payment),
      refundable: rules.isRefundable(booking.startAt, now),
      passToken: booking.passToken,
    };
  }

  private async validateRequest(
    rules: CarBayRules,
    request: CarBayRequest,
    customerEmail: string,
    now: DateTime,
    options: { enforceHorizon: boolean },
  ) {
    const period = rules.resolvePeriod(request, now, options);

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

    const blockedUntil = rules.blockedUntil(period.endAt);
    const [overlapping, closures] = await Promise.all([
      this.carBayRepository.getConfirmedInRange(period.startAt, blockedUntil),
      this.carBayRepository.getClosuresInRange(period.startAt, blockedUntil),
    ]);
    if (closures.length > 0) throw new CarBayRuleError(CLOSED_MESSAGE);
    if (overlapping.length > 0) throw new CarBaySlotTakenError();

    return period;
  }

  async staffClose(dto: StaffCloseCarBayDto, staffEmail: string) {
    const rules = await this.rules();
    const period = rules.resolveClosure(dto);

    const bookings = await this.carBayRepository.getConfirmedInRange(period.startAt, period.endAt);
    if (bookings.length > 0) {
      throw new CarBayRuleError('Cancel the bookings in that time before closing the bay');
    }

    const closure = await this.carBayRepository.createClosure({
      startAt: period.startAt,
      endAt: period.endAt,
      reason: dto.reason || null,
      createdByEmail: staffEmail,
    });
    return toClosureView(closure);
  }

  async reopen(closureId: string) {
    const closure = await this.carBayRepository.deleteClosure(closureId);
    if (!closure) throw new CarBayRuleError('Closure not found');
    return toClosureView(closure);
  }

  async isMember(customerEmail: string) {
    const context = await this.memberRepository.getAccessContextByEmail(customerEmail);
    return context !== undefined && hasMembership(context, DateTime.now());
  }

  async book(dto: BookCarBayDto, now: DateTime = DateTime.now()) {
    const rules = await this.rules();
    const period = await this.validateRequest(rules, dto.request, dto.customerEmail, now, {
      enforceHorizon: true,
    });

    const [rates, isMember] = await Promise.all([
      this.settingsRepository.getSetting('carBayRates'),
      this.isMember(dto.customerEmail),
    ]);

    const authorized = await this.paymentRepository
      .authorize(
        {
          type: PAYMENT_TYPE.CAR_BAY_BOOKING,
          status: PAYMENT_STATUS.PENDING,
          customer: { name: dto.customerName, email: dto.customerEmail },
          bill: buildBill(bookingLineItems(dto.request, rates, isMember)),
        },
        dto.sourceId,
      )
      .catch(toPaymentError);

    let booking: CarBayBooking;
    try {
      booking = await this.carBayRepository.create({
        tier: dto.request.tier,
        status: CAR_BAY_STATUS.CONFIRMED,
        startAt: period.startAt,
        endAt: period.endAt,
        blockedUntil: rules.blockedUntil(period.endAt),
        ...(await this.customerColumns({ ...dto, isMember })),
        paymentId: authorized.id,
      });
    } catch (error) {
      await this.paymentRepository.void(authorized);
      throw error;
    }

    let payment: Payment;
    try {
      payment = await this.paymentRepository.capture(authorized);
    } catch (error) {
      await this.carBayRepository.update(booking.id, { status: CAR_BAY_STATUS.CANCELED });
      toPaymentError(error);
    }

    runInBackground(
      this.sendConfirmationEmail(booking, payment, rules.policy),
      'send car bay booking email',
    );
    return toView(booking, payment);
  }

  async staffBook(dto: StaffBookCarBayDto, staffEmail: string, now: DateTime = DateTime.now()) {
    const rules = await this.rules();
    const period = await this.validateRequest(rules, dto.request, dto.customerEmail, now, {
      enforceHorizon: false,
    });

    const booking = await this.carBayRepository.create({
      tier: dto.request.tier,
      status: CAR_BAY_STATUS.CONFIRMED,
      startAt: period.startAt,
      endAt: period.endAt,
      blockedUntil: rules.blockedUntil(period.endAt),
      ...(await this.customerColumns(dto)),
      createdByEmail: staffEmail,
    });

    runInBackground(
      this.sendConfirmationEmail(booking, null, rules.policy),
      'send car bay booking email',
    );
    return toView(booking, null);
  }

  private async customerColumns(dto: CustomerDetails) {
    const member = await this.memberRepository.upsertByEmail(dto.customerName, dto.customerEmail);
    return {
      memberId: member.id,
      isMember: dto.isMember,
      customerName: dto.customerName,
      customerEmail: dto.customerEmail,
      customerPhone: dto.customerPhone,
    };
  }

  private async refund(booking: CarBayBookingWithPayment) {
    if (!booking.payment) return false;
    return await this.paymentRepository.refund(booking.payment);
  }

  private requireConfirmed(booking: CarBayBookingWithPayment | null): CarBayBookingWithPayment {
    if (!booking) throw new CarBayRuleError('Booking not found');
    if (booking.status !== CAR_BAY_STATUS.CONFIRMED)
      throw new CarBayRuleError('This booking is no longer active');
    return booking;
  }

  async cancelByToken(token: string, now: DateTime = DateTime.now()) {
    const rules = await this.rules();
    const booking = this.requireConfirmed(await this.carBayRepository.getByToken(token));
    const refunded = rules.isRefundable(booking.startAt, now) && (await this.refund(booking));

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
      booking.payment,
    );
  }

  async sendOverrunInvoice(dto: SendCarBayOverrunInvoiceDto) {
    const booking = this.requireConfirmed(await this.carBayRepository.getById(dto.bookingId));

    const rates = await this.settingsRepository.getSetting('carBayRates');
    const bookingEndDate = booking.endAt.toISODate()!;
    const paymentId = crypto.randomUUID();
    const payment = await this.paymentRepository.save(
      {
        type: PAYMENT_TYPE.CAR_BAY_OVERRUN,
        status: PAYMENT_STATUS.PENDING,
        customer: { name: booking.customerName, email: booking.customerEmail },
        bill: buildBill(overrunLineItems(dto.overrun, bookingEndDate, rates, booking.isMember)),
        paymentUrl: payUrl({ id: paymentId }),
      },
      paymentId,
    );
    await this.carBayRepository.createOverrun(booking.id, payment.id);

    await this.mailgunRepository.sendTemplate(
      booking.customerEmail,
      CAR_BAY_SENDER,
      CAR_BAY_EMAIL,
      'car_bay_overrun',
      {
        customerName: booking.customerName,
        bookingEndDate: booking.endAt.setZone(CAR_BAY_ZONE).toFormat('MMMM d'),
        total: centsToDollars(payment.total),
        paymentUrl: payUrl(payment),
      },
    );

    return payment;
  }

  async sendDueReminders(now: DateTime = DateTime.now()) {
    const rules = await this.rules();
    const candidates = await this.carBayRepository.getReminderCandidates(
      now,
      now.plus({ hours: rules.policy.reminderLeadHours }),
    );

    for (const booking of candidates.filter((b) => rules.needsReminder(b.createdDate, b.startAt))) {
      try {
        await this.mailgunRepository.sendTemplate(
          booking.customerEmail,
          CAR_BAY_SENDER,
          CAR_BAY_EMAIL,
          'car_bay_reminder',
          {
            customerName: booking.customerName,
            tierName: CAR_BAY_TIER_NAMES[booking.tier],
            bookingWhen: formatPeriod(booking),
            bookingUrl: this.bookingUrl(booking),
            ...passLinks(booking),
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

  async sendConfirmationEmail(
    booking: CarBayBooking,
    payment: Payment | null,
    policy: CarBayPolicy,
  ) {
    await this.mailgunRepository.sendTemplate(
      booking.customerEmail,
      CAR_BAY_SENDER,
      CAR_BAY_EMAIL,
      'car_bay_booking',
      {
        customerName: booking.customerName,
        tierName: CAR_BAY_TIER_NAMES[booking.tier],
        bookingWhen: formatPeriod(booking),
        amountPaid: centsToDollars(amountPaid(payment)),
        refundCutoffHours: policy.refundCutoffHours.toString(),
        storageDays: policy.storageDays.toString(),
        bookingUrl: this.bookingUrl(booking),
        ...passLinks(booking),
      },
    );
  }
}

export const carBayService = new CarBayService();
