import { DateTime } from 'luxon';

export const CAR_BAY_ZONE = 'America/Chicago';
export const CAR_BAY_BUFFER_MINUTES = 30;
export const CAR_BAY_PUBLIC_HORIZON_DAYS = 7;
export const CAR_BAY_REFUND_CUTOFF_HOURS = 12;
export const CAR_BAY_REMINDER_LEAD_HOURS = 24;

export const QUICK_JOB_MINUTES = 90;
export const HOURLY_MIN_HOURS = 2;
export const FULL_DAY_MAX_DAYS = 3;

/** The earliest any day opens, which is where the week view starts. */
export const CAR_BAY_EARLIEST_OPEN_HOUR = 12;
export const CAR_BAY_CLOSE_HOUR = 21;

const WEEKDAY_OPEN_HOUR = 16;
const WEEKEND_OPEN_HOUR = CAR_BAY_EARLIEST_OPEN_HOUR;
const WEEKEND_DAYS = [6, 7];

export const CAR_BAY_TIER = {
  QUICK_JOB: 'quick_job',
  HOURLY: 'hourly',
  FULL_DAY: 'full_day',
} as const;

export type CarBayTier = (typeof CAR_BAY_TIER)[keyof typeof CAR_BAY_TIER];

export const CAR_BAY_TIER_NAMES: Record<CarBayTier, string> = {
  quick_job: 'Quick Job',
  hourly: 'Hourly',
  full_day: 'Full Day',
};

export const CAR_BAY_OVERRUN = {
  HOURLY: 'hourly',
  OVERNIGHT: 'overnight',
} as const;

export type PricePair = { member: number; nonMember: number };

/** All amounts are in cents. */
export type CarBayRates = {
  quickJob: PricePair;
  hourly: PricePair;
  fullDayWeekday: PricePair;
  fullDayWeekend: PricePair;
  overrunHourly: PricePair;
  overnightFee: number;
};

export const DEFAULT_CAR_BAY_RATES: CarBayRates = {
  quickJob: { member: 1200, nonMember: 1800 },
  hourly: { member: 1000, nonMember: 1500 },
  fullDayWeekday: { member: 2500, nonMember: 3800 },
  fullDayWeekend: { member: 4500, nonMember: 7000 },
  overrunHourly: { member: 1500, nonMember: 2000 },
  overnightFee: 3000,
};

export type CarBayRequest =
  | { tier: typeof CAR_BAY_TIER.QUICK_JOB; date: string; startHour: number }
  | { tier: typeof CAR_BAY_TIER.HOURLY; date: string; startHour: number; hours: number }
  | { tier: typeof CAR_BAY_TIER.FULL_DAY; date: string; days: number };

export type CarBayOverrun =
  | { kind: typeof CAR_BAY_OVERRUN.HOURLY; hours: number }
  | { kind: typeof CAR_BAY_OVERRUN.OVERNIGHT; nights: number; extraDays: number };

export type CarBayPeriod = { startAt: DateTime; endAt: DateTime };

export type CarBayLineItem = { name: string; quantity: number; unitAmount: number };

export class CarBayRuleError extends Error {}

function day(date: string) {
  const parsed = DateTime.fromISO(date, { zone: CAR_BAY_ZONE });
  if (!parsed.isValid) throw new CarBayRuleError('Invalid date');
  return parsed.startOf('day');
}

export function isWeekend(date: string) {
  return WEEKEND_DAYS.includes(day(date).weekday);
}

export function openWindow(date: string) {
  const start = day(date);
  const openHour = isWeekend(date) ? WEEKEND_OPEN_HOUR : WEEKDAY_OPEN_HOUR;
  return { open: start.set({ hour: openHour }), close: start.set({ hour: CAR_BAY_CLOSE_HOUR }) };
}

export function slotHours(date: string) {
  const { open, close } = openWindow(date);
  return Array.from({ length: close.hour - open.hour }, (_, i) => open.hour + i);
}

export function consecutiveDates(date: string, days: number) {
  return Array.from({ length: days }, (_, i) => day(date).plus({ days: i }).toISODate()!);
}

export function todayInZone(now: DateTime) {
  return now.setZone(CAR_BAY_ZONE).toISODate()!;
}

function startOfSlot(date: string, startHour: number) {
  const { open, close } = openWindow(date);
  if (!Number.isInteger(startHour) || startHour < open.hour || startHour >= close.hour) {
    throw new CarBayRuleError('The bay is closed at that time');
  }
  return open.set({ hour: startHour });
}

function periodFor(request: CarBayRequest): CarBayPeriod {
  if (request.tier === CAR_BAY_TIER.QUICK_JOB) {
    const startAt = startOfSlot(request.date, request.startHour);
    return { startAt, endAt: startAt.plus({ minutes: QUICK_JOB_MINUTES }) };
  }

  if (request.tier === CAR_BAY_TIER.HOURLY) {
    if (!Number.isInteger(request.hours)) {
      throw new CarBayRuleError('Hourly bookings are whole hours only');
    }
    if (request.hours < HOURLY_MIN_HOURS) {
      throw new CarBayRuleError(`Hourly bookings are at least ${HOURLY_MIN_HOURS} hours`);
    }
    const startAt = startOfSlot(request.date, request.startHour);
    return { startAt, endAt: startAt.plus({ hours: request.hours }) };
  }

  if (!Number.isInteger(request.days) || request.days < 1 || request.days > FULL_DAY_MAX_DAYS) {
    throw new CarBayRuleError(`Full Day bookings span 1 to ${FULL_DAY_MAX_DAYS} days`);
  }
  const dates = consecutiveDates(request.date, request.days);
  return { startAt: openWindow(dates[0]).open, endAt: openWindow(dates.at(-1)!).close };
}

export function resolvePeriod(
  request: CarBayRequest,
  now: DateTime,
  options: { enforceHorizon: boolean },
): CarBayPeriod {
  const period = periodFor(request);
  const { close } = openWindow(period.endAt.toISODate()!);

  if (period.endAt > close) {
    throw new CarBayRuleError('The booking runs past closing time');
  }

  const latestStart =
    request.tier === CAR_BAY_TIER.FULL_DAY
      ? openWindow(request.date).close
      : period.startAt.plus({ hours: 1 });
  if (latestStart <= now) {
    throw new CarBayRuleError('That time has already passed');
  }

  const lastBookableDay = day(todayInZone(now)).plus({ days: CAR_BAY_PUBLIC_HORIZON_DAYS });
  if (options.enforceHorizon && period.endAt.startOf('day') > lastBookableDay) {
    throw new CarBayRuleError(
      `Bookings can be made up to ${CAR_BAY_PUBLIC_HORIZON_DAYS} days in advance`,
    );
  }

  return period;
}

export function blockedUntil(endAt: DateTime) {
  return endAt.plus({ minutes: CAR_BAY_BUFFER_MINUTES });
}

export function periodsConflict(a: CarBayPeriod, b: CarBayPeriod) {
  return a.startAt < blockedUntil(b.endAt) && b.startAt < blockedUntil(a.endAt);
}

export function requestFits(
  request: CarBayRequest,
  existing: CarBayPeriod[],
  now: DateTime,
  options: { enforceHorizon: boolean },
) {
  try {
    const period = resolvePeriod(request, now, options);
    return !existing.some((booking) => periodsConflict(period, booking));
  } catch (error) {
    if (error instanceof CarBayRuleError) return false;
    throw error;
  }
}

export function toPeriod(booking: { startAt: string; endAt: string }): CarBayPeriod {
  return {
    startAt: DateTime.fromISO(booking.startAt, { zone: CAR_BAY_ZONE }),
    endAt: DateTime.fromISO(booking.endAt, { zone: CAR_BAY_ZONE }),
  };
}

export function isRefundable(startAt: DateTime, now: DateTime) {
  return now <= startAt.minus({ hours: CAR_BAY_REFUND_CUTOFF_HOURS });
}

export function needsReminder(createdAt: DateTime, startAt: DateTime) {
  return startAt.diff(createdAt, 'hours').hours > CAR_BAY_REMINDER_LEAD_HOURS;
}

export function clipToDay(period: CarBayPeriod, date: string) {
  const { open, close } = openWindow(date);
  const start = DateTime.max(period.startAt, open);
  const end = DateTime.min(blockedUntil(period.endAt), close);
  return start < end ? { start, end } : null;
}

function rate(pair: PricePair, isMember: boolean) {
  return isMember ? pair.member : pair.nonMember;
}

function memberLabel(isMember: boolean) {
  return isMember ? 'Member' : 'Non-member';
}

function fullDayRate(date: string, rates: CarBayRates) {
  return isWeekend(date) ? rates.fullDayWeekend : rates.fullDayWeekday;
}

function fullDayLineItem(date: string, rates: CarBayRates, isMember: boolean): CarBayLineItem {
  const kind = isWeekend(date) ? 'Weekend' : 'Weekday';
  return {
    name: `Car Bay - Full Day ${kind}, ${day(date).toFormat('MMM d')} (${memberLabel(isMember)})`,
    quantity: 1,
    unitAmount: rate(fullDayRate(date, rates), isMember),
  };
}

function overnightLineItem(nights: number, rates: CarBayRates): CarBayLineItem {
  return { name: 'Car Bay - Overnight Fee', quantity: nights, unitAmount: rates.overnightFee };
}

export function bookingLineItems(
  request: CarBayRequest,
  rates: CarBayRates,
  isMember: boolean,
): CarBayLineItem[] {
  const label = memberLabel(isMember);

  if (request.tier === CAR_BAY_TIER.QUICK_JOB) {
    return [
      {
        name: `Car Bay - Quick Job (${label})`,
        quantity: 1,
        unitAmount: rate(rates.quickJob, isMember),
      },
    ];
  }

  if (request.tier === CAR_BAY_TIER.HOURLY) {
    return [
      {
        name: `Car Bay - Hourly (${label})`,
        quantity: request.hours,
        unitAmount: rate(rates.hourly, isMember),
      },
    ];
  }

  const items = consecutiveDates(request.date, request.days).map((date) =>
    fullDayLineItem(date, rates, isMember),
  );
  const nights = request.days - 1;
  return nights > 0 ? [...items, overnightLineItem(nights, rates)] : items;
}

export function overrunLineItems(
  overrun: CarBayOverrun,
  bookingEndDate: string,
  rates: CarBayRates,
  isMember: boolean,
): CarBayLineItem[] {
  if (overrun.kind === CAR_BAY_OVERRUN.HOURLY) {
    if (!Number.isInteger(overrun.hours) || overrun.hours < 1) {
      throw new CarBayRuleError('Overrun is billed in whole hours');
    }
    return [
      {
        name: `Car Bay - Overrun (${memberLabel(isMember)})`,
        quantity: overrun.hours,
        unitAmount: rate(rates.overrunHourly, isMember),
      },
    ];
  }

  if (!Number.isInteger(overrun.nights) || overrun.nights < 1) {
    throw new CarBayRuleError('Overnight charges need at least one night');
  }
  if (!Number.isInteger(overrun.extraDays) || overrun.extraDays < 0) {
    throw new CarBayRuleError('Extra days must be zero or more');
  }
  if (overrun.extraDays > overrun.nights) {
    throw new CarBayRuleError('Each extra day follows a night on the property');
  }

  const extraDates = consecutiveDates(bookingEndDate, overrun.extraDays + 1).slice(1);
  return [
    overnightLineItem(overrun.nights, rates),
    ...extraDates.map((date) => fullDayLineItem(date, rates, isMember)),
  ];
}

export function formatPeriod({ startAt, endAt }: CarBayPeriod) {
  const start = startAt.setZone(CAR_BAY_ZONE);
  const end = endAt.setZone(CAR_BAY_ZONE);

  if (start.hasSame(end, 'day')) {
    return `${start.toFormat('EEEE, MMMM d')}, ${start.toFormat('h:mm a')} – ${end.toFormat('h:mm a')}`;
  }
  return `${start.toFormat('EEE, MMM d, h:mm a')} – ${end.toFormat('EEE, MMM d, h:mm a')}`;
}

export function formatDollars(cents: number) {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

export function lineItemsTotal(items: CarBayLineItem[]) {
  return items.reduce((total, item) => total + item.quantity * item.unitAmount, 0);
}
