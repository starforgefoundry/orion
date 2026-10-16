import { DateTime } from 'luxon';

export const CAR_BAY_ZONE = 'America/Chicago';

const WEEKEND_DAYS = [6, 7];

export const CAR_BAY_TIER = {
  QUICK_JOB: 'quick_job',
  HOURLY: 'hourly',
  FULL_DAY: 'full_day',
} as const;

export type CarBayTier = (typeof CAR_BAY_TIER)[keyof typeof CAR_BAY_TIER];

export const CAR_BAY_TIER_NAMES: Record<CarBayTier, string> = {
  [CAR_BAY_TIER.QUICK_JOB]: 'Quick Job',
  [CAR_BAY_TIER.HOURLY]: 'Hourly',
  [CAR_BAY_TIER.FULL_DAY]: 'Full Day',
};

export const CAR_BAY_STATUS = {
  CONFIRMED: 'confirmed',
  CANCELED: 'canceled',
  NO_SHOW: 'no_show',
} as const;

export const CENTS_PER_DOLLAR = 100;

export const CAR_BAY_OVERRUN = {
  HOURLY: 'hourly',
  OVERNIGHT: 'overnight',
} as const;

/** Hours are on a 24 hour clock in Central time. */
export type CarBayPolicy = {
  weekdayOpenHour: number;
  weekendOpenHour: number;
  weekdayCloseHour: number;
  weekendCloseHour: number;
  quickJobMinutes: number;
  hourlyMinHours: number;
  fullDayMaxDays: number;
  bufferMinutes: number;
  publicHorizonDays: number;
  refundCutoffHours: number;
  reminderLeadHours: number;
  storageDays: number;
};

export const DEFAULT_CAR_BAY_POLICY: CarBayPolicy = {
  weekdayOpenHour: 16,
  weekendOpenHour: 12,
  weekdayCloseHour: 21,
  weekendCloseHour: 21,
  quickJobMinutes: 90,
  hourlyMinHours: 2,
  fullDayMaxDays: 3,
  bufferMinutes: 30,
  publicHorizonDays: 7,
  refundCutoffHours: 12,
  reminderLeadHours: 24,
  storageDays: 3,
};

export type PricePair = { member: number; nonMember: number };

/** All amounts are in cents. */
export type CarBayRates = {
  quickJob: PricePair;
  hourly: PricePair;
  fullDayWeekday: PricePair;
  fullDayWeekend: PricePair;
  overrunHourly: PricePair;
  overnightFee: PricePair;
};

export const DEFAULT_CAR_BAY_RATES: CarBayRates = {
  quickJob: { member: 1200, nonMember: 1800 },
  hourly: { member: 1000, nonMember: 1500 },
  fullDayWeekday: { member: 2500, nonMember: 3800 },
  fullDayWeekend: { member: 4500, nonMember: 7000 },
  overrunHourly: { member: 1500, nonMember: 2000 },
  overnightFee: { member: 3000, nonMember: 3000 },
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

export class CarBaySlotTakenError extends CarBayRuleError {
  constructor() {
    super('That time was just booked by someone else. Please pick another time.');
  }
}

function day(date: string) {
  const parsed = DateTime.fromISO(date, { zone: CAR_BAY_ZONE });
  if (!parsed.isValid) throw new CarBayRuleError('Invalid date');
  return parsed.startOf('day');
}

export function isWeekend(date: string) {
  return WEEKEND_DAYS.includes(day(date).weekday);
}

export function consecutiveDates(date: string, days: number) {
  return Array.from({ length: days }, (_, i) => day(date).plus({ days: i }).toISODate()!);
}

export function todayInZone(now: DateTime) {
  return now.setZone(CAR_BAY_ZONE).toISODate()!;
}

export function toPeriod(booking: { startAt: string; endAt: string }): CarBayPeriod {
  return {
    startAt: DateTime.fromISO(booking.startAt, { zone: CAR_BAY_ZONE }),
    endAt: DateTime.fromISO(booking.endAt, { zone: CAR_BAY_ZONE }),
  };
}

export class CarBayRules {
  constructor(readonly policy: CarBayPolicy) {}

  get earliestOpenHour() {
    return Math.min(this.policy.weekdayOpenHour, this.policy.weekendOpenHour);
  }

  get latestCloseHour() {
    return Math.max(this.policy.weekdayCloseHour, this.policy.weekendCloseHour);
  }

  openWindow(date: string) {
    const start = day(date);
    const weekend = isWeekend(date);
    return {
      open: start.set({
        hour: weekend ? this.policy.weekendOpenHour : this.policy.weekdayOpenHour,
      }),
      close: start.set({
        hour: weekend ? this.policy.weekendCloseHour : this.policy.weekdayCloseHour,
      }),
    };
  }

  slotHours(date: string) {
    const { open, close } = this.openWindow(date);
    return Array.from({ length: close.hour - open.hour }, (_, i) => open.hour + i);
  }

  #startOfSlot(date: string, startHour: number) {
    const { open, close } = this.openWindow(date);
    if (!Number.isInteger(startHour) || startHour < open.hour || startHour >= close.hour) {
      throw new CarBayRuleError('The bay is closed at that time');
    }
    return open.set({ hour: startHour });
  }

  #periodFor(request: CarBayRequest): CarBayPeriod {
    if (request.tier === CAR_BAY_TIER.QUICK_JOB) {
      const startAt = this.#startOfSlot(request.date, request.startHour);
      return { startAt, endAt: startAt.plus({ minutes: this.policy.quickJobMinutes }) };
    }

    if (request.tier === CAR_BAY_TIER.HOURLY) {
      if (!Number.isInteger(request.hours)) {
        throw new CarBayRuleError('Hourly bookings are whole hours only');
      }
      if (request.hours < this.policy.hourlyMinHours) {
        throw new CarBayRuleError(
          `Hourly bookings are at least ${this.policy.hourlyMinHours} hours`,
        );
      }
      const startAt = this.#startOfSlot(request.date, request.startHour);
      return { startAt, endAt: startAt.plus({ hours: request.hours }) };
    }

    const maxDays = this.policy.fullDayMaxDays;
    if (!Number.isInteger(request.days) || request.days < 1 || request.days > maxDays) {
      throw new CarBayRuleError(`Full Day bookings span 1 to ${maxDays} days`);
    }
    const dates = consecutiveDates(request.date, request.days);
    return {
      startAt: this.openWindow(dates[0]).open,
      endAt: this.openWindow(dates.at(-1)!).close,
    };
  }

  resolvePeriod(
    request: CarBayRequest,
    now: DateTime,
    options: { enforceHorizon: boolean },
  ): CarBayPeriod {
    const period = this.#periodFor(request);
    const lastDate =
      request.tier === CAR_BAY_TIER.FULL_DAY
        ? consecutiveDates(request.date, request.days).at(-1)!
        : request.date;

    if (period.endAt > this.openWindow(lastDate).close) {
      throw new CarBayRuleError('The booking runs past closing time');
    }

    const latestStart =
      request.tier === CAR_BAY_TIER.FULL_DAY
        ? this.openWindow(request.date).close
        : period.startAt.plus({ hours: 1 });
    if (latestStart <= now) {
      throw new CarBayRuleError('That time has already passed');
    }

    const horizon = this.policy.publicHorizonDays;
    const lastBookableDay = day(todayInZone(now)).plus({ days: horizon });
    if (options.enforceHorizon && period.endAt.startOf('day') > lastBookableDay) {
      throw new CarBayRuleError(`Bookings can be made up to ${horizon} days in advance`);
    }

    return period;
  }

  blockedUntil(endAt: DateTime) {
    return endAt.plus({ minutes: this.policy.bufferMinutes });
  }

  periodsConflict(a: CarBayPeriod, b: CarBayPeriod) {
    return a.startAt < this.blockedUntil(b.endAt) && b.startAt < this.blockedUntil(a.endAt);
  }

  requestFits(
    request: CarBayRequest,
    existing: CarBayPeriod[],
    now: DateTime,
    options: { enforceHorizon: boolean },
  ) {
    try {
      const period = this.resolvePeriod(request, now, options);
      return !existing.some((booking) => this.periodsConflict(period, booking));
    } catch (error) {
      if (error instanceof CarBayRuleError) return false;
      throw error;
    }
  }

  isRefundable(startAt: DateTime, now: DateTime) {
    return now <= startAt.minus({ hours: this.policy.refundCutoffHours });
  }

  needsReminder(createdAt: DateTime, startAt: DateTime) {
    return startAt.diff(createdAt, 'hours').hours > this.policy.reminderLeadHours;
  }

  clipToDay(period: CarBayPeriod, date: string) {
    const { open, close } = this.openWindow(date);
    const start = DateTime.max(period.startAt, open);
    const end = DateTime.min(this.blockedUntil(period.endAt), close);
    return start < end ? { start, end } : null;
  }
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

function overnightLineItem(nights: number, rates: CarBayRates, isMember: boolean): CarBayLineItem {
  return {
    name: `Car Bay - Overnight Fee (${memberLabel(isMember)})`,
    quantity: nights,
    unitAmount: rate(rates.overnightFee, isMember),
  };
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
  return nights > 0 ? [...items, overnightLineItem(nights, rates, isMember)] : items;
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
    overnightLineItem(overrun.nights, rates, isMember),
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
  return `$${(cents / CENTS_PER_DOLLAR).toFixed(cents % CENTS_PER_DOLLAR === 0 ? 0 : 2)}`;
}

export function formatHour(hour: number) {
  return DateTime.fromObject({ hour }).toFormat('h a');
}

export function lineItemsTotal(items: CarBayLineItem[]) {
  return items.reduce((total, item) => total + item.quantity * item.unitAmount, 0);
}
