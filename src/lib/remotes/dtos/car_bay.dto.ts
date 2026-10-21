import type { CarBayBooking, Payment } from '$lib/server/db/schema';
import { CAR_BAY_OVERRUN, CAR_BAY_TIER, type CarBayTier } from '$lib/utils/car_bay';
import * as v from 'valibot';

const isoDate = v.pipe(v.string(), v.isoDate());
const wholeNumber = v.pipe(v.number(), v.integer());

export const carBayRequestDto = v.variant('tier', [
  v.object({ tier: v.literal(CAR_BAY_TIER.QUICK_JOB), date: isoDate, startHour: wholeNumber }),
  v.object({
    tier: v.literal(CAR_BAY_TIER.HOURLY),
    date: isoDate,
    startHour: wholeNumber,
    hours: wholeNumber,
  }),
  v.object({ tier: v.literal(CAR_BAY_TIER.FULL_DAY), date: isoDate, days: wholeNumber }),
]);

export const customerEmailDto = v.pipe(v.string(), v.trim(), v.toLowerCase(), v.email());

const customerFields = {
  customerName: v.pipe(v.string(), v.trim(), v.minLength(1)),
  customerEmail: customerEmailDto,
  customerPhone: v.pipe(v.string(), v.trim(), v.minLength(1)),
};

export const bookCarBayDto = v.object({
  request: carBayRequestDto,
  ...customerFields,
  sourceId: v.pipe(v.string(), v.minLength(1)), // Square payment nonce
});

export type BookCarBayDto = v.InferOutput<typeof bookCarBayDto>;

export const staffBookCarBayDto = v.object({
  request: carBayRequestDto,
  ...customerFields,
  isMember: v.boolean(),
});

export type StaffBookCarBayDto = v.InferOutput<typeof staffBookCarBayDto>;

export const cancelCarBayBookingDto = v.object({
  bookingToken: v.string(),
});

export const staffCancelCarBayBookingDto = v.object({
  bookingId: v.string(),
  refund: v.boolean(),
});

export type StaffCancelCarBayBookingDto = v.InferOutput<typeof staffCancelCarBayBookingDto>;

export const carBayBookingIdDto = v.object({
  bookingId: v.string(),
});

export const carBayOverrunDto = v.variant('kind', [
  v.object({ kind: v.literal(CAR_BAY_OVERRUN.HOURLY), hours: wholeNumber }),
  v.object({
    kind: v.literal(CAR_BAY_OVERRUN.OVERNIGHT),
    nights: wholeNumber,
    extraDays: wholeNumber,
  }),
]);

export const sendCarBayOverrunInvoiceDto = v.object({
  bookingId: v.string(),
  overrun: carBayOverrunDto,
});

export type SendCarBayOverrunInvoiceDto = v.InferOutput<typeof sendCarBayOverrunInvoiceDto>;

export const staffCloseCarBayDto = v.object({
  date: isoDate,
  startHour: wholeNumber,
  endHour: wholeNumber,
  reason: v.pipe(v.string(), v.trim()),
});

export type StaffCloseCarBayDto = v.InferOutput<typeof staffCloseCarBayDto>;

export const carBayClosureIdDto = v.object({
  closureId: v.string(),
});

export const carBayRangeDto = v.object({
  from: isoDate,
  to: isoDate,
});

/** Times are ISO strings so the browser never reinterprets them in its own zone. */
export type PublicCarBaySlot = {
  id: string;
  startAt: string;
  endAt: string;
  blockedUntil: string;
};

export type PublicCarBayClosure = {
  id: string;
  startAt: string;
  endAt: string;
};

export type CarBayClosureView = PublicCarBayClosure & { reason: string | null };

export type PublicCarBaySchedule = {
  today: string;
  bookings: PublicCarBaySlot[];
  closures: PublicCarBayClosure[];
};

export type CarBayBookingView = Omit<
  CarBayBooking,
  'startAt' | 'endAt' | 'blockedUntil' | 'createdDate' | 'reminderSentDate'
> & {
  startAt: string;
  endAt: string;
  blockedUntil: string;
  createdDate: string;
};

export type CarBayStaffSchedule = {
  bookings: CarBayBookingView[];
  closures: CarBayClosureView[];
};

export type CarBayOverrunInvoiceView = Pick<Payment, 'id' | 'status' | 'total' | 'paymentUrl'> & {
  issuedDate: string;
};

export type CarBayBookingDetail = CarBayBookingView & {
  refundable: boolean;
  overrunInvoices: CarBayOverrunInvoiceView[];
};

export type CustomerCarBayBooking = {
  id: string;
  tier: CarBayTier;
  status: CarBayBooking['status'];
  startAt: string;
  endAt: string;
  customerName: string;
  customerEmail: string;
  amountPaid: number;
  refundable: boolean;
};
