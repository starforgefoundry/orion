import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import {
  CAR_BAY_ZONE,
  CarBayRuleError,
  CarBayRules,
  DEFAULT_CAR_BAY_POLICY,
  DEFAULT_CAR_BAY_RATES,
  bookingLineItems,
  lineItemsTotal,
  overrunLineItems,
} from './car_bay';

// 2026-10-12 is a Monday.
const MONDAY = '2026-10-12';
const FRIDAY = '2026-10-16';
const SATURDAY = '2026-10-17';
const SUNDAY = '2026-10-18';

function at(iso: string) {
  return DateTime.fromISO(iso, { zone: CAR_BAY_ZONE });
}

const SUNDAY_BEFORE = at('2026-10-11T09:00');
const PUBLIC = { enforceHorizon: true };
const STAFF = { enforceHorizon: false };
const rules = new CarBayRules(DEFAULT_CAR_BAY_POLICY);

describe('openWindow', () => {
  it('opens weekdays from 4 PM to 9 PM', () => {
    const { open, close } = rules.openWindow(MONDAY);
    expect(open.toFormat('HH:mm')).toBe('16:00');
    expect(close.toFormat('HH:mm')).toBe('21:00');
  });

  it('opens weekends from noon to 9 PM', () => {
    expect(rules.openWindow(SATURDAY).open.toFormat('HH:mm')).toBe('12:00');
    expect(rules.openWindow(SUNDAY).open.toFormat('HH:mm')).toBe('12:00');
  });

  it('offers a start slot for every open hour', () => {
    expect(rules.slotHours(MONDAY)).toEqual([16, 17, 18, 19, 20]);
    expect(rules.slotHours(SATURDAY)).toHaveLength(9);
  });
});

describe('resolvePeriod', () => {
  it('fixes a Quick Job at 90 minutes', () => {
    const period = rules.resolvePeriod(
      { tier: 'quick_job', date: MONDAY, startHour: 16 },
      SUNDAY_BEFORE,
      PUBLIC,
    );
    expect(period.endAt.toFormat('HH:mm')).toBe('17:30');
  });

  it('rejects a Quick Job that would run past closing', () => {
    expect(() =>
      rules.resolvePeriod(
        { tier: 'quick_job', date: MONDAY, startHour: 20 },
        SUNDAY_BEFORE,
        PUBLIC,
      ),
    ).toThrow(CarBayRuleError);
  });

  it('rejects starts outside the open window', () => {
    expect(() =>
      rules.resolvePeriod(
        { tier: 'quick_job', date: MONDAY, startHour: 12 },
        SUNDAY_BEFORE,
        PUBLIC,
      ),
    ).toThrow('closed');
  });

  it('requires at least 2 hours for Hourly', () => {
    expect(() =>
      rules.resolvePeriod(
        { tier: 'hourly', date: MONDAY, startHour: 16, hours: 1 },
        SUNDAY_BEFORE,
        PUBLIC,
      ),
    ).toThrow('at least 2 hours');
  });

  it('rejects partial hours for Hourly', () => {
    expect(() =>
      rules.resolvePeriod(
        { tier: 'hourly', date: MONDAY, startHour: 16, hours: 2.5 },
        SUNDAY_BEFORE,
        PUBLIC,
      ),
    ).toThrow('whole hours');
  });

  it('caps Hourly at the open window', () => {
    expect(
      rules
        .resolvePeriod(
          { tier: 'hourly', date: MONDAY, startHour: 16, hours: 5 },
          SUNDAY_BEFORE,
          PUBLIC,
        )
        .endAt.toFormat('HH:mm'),
    ).toBe('21:00');
    expect(() =>
      rules.resolvePeriod(
        { tier: 'hourly', date: MONDAY, startHour: 16, hours: 6 },
        SUNDAY_BEFORE,
        PUBLIC,
      ),
    ).toThrow('past closing');
  });

  it('rejects an Hourly booking that runs past midnight into the next day', () => {
    for (const hours of [4, 24]) {
      expect(() =>
        rules.resolvePeriod(
          { tier: 'hourly', date: MONDAY, startHour: 20, hours },
          SUNDAY_BEFORE,
          STAFF,
        ),
      ).toThrow('past closing');
    }
  });

  it('books the entire window for a Full Day', () => {
    const period = rules.resolvePeriod(
      { tier: 'full_day', date: SATURDAY, days: 1 },
      SUNDAY_BEFORE,
      PUBLIC,
    );
    expect(period.startAt.toISO()).toBe(rules.openWindow(SATURDAY).open.toISO());
    expect(period.endAt.toISO()).toBe(rules.openWindow(SATURDAY).close.toISO());
  });

  it('spans consecutive Full Days and rejects more than 3', () => {
    const period = rules.resolvePeriod(
      { tier: 'full_day', date: FRIDAY, days: 3 },
      SUNDAY_BEFORE,
      STAFF,
    );
    expect(period.endAt.toISODate()).toBe(SUNDAY);
    expect(() =>
      rules.resolvePeriod({ tier: 'full_day', date: FRIDAY, days: 4 }, SUNDAY_BEFORE, STAFF),
    ).toThrow('1 to 3');
  });

  it('lets a walk-in book the hour already in progress', () => {
    const now = at(`${MONDAY}T16:20`);
    expect(() =>
      rules.resolvePeriod({ tier: 'quick_job', date: MONDAY, startHour: 16 }, now, PUBLIC),
    ).not.toThrow();
  });

  it('rejects an hour that has already finished', () => {
    const now = at(`${MONDAY}T17:00`);
    expect(() =>
      rules.resolvePeriod({ tier: 'quick_job', date: MONDAY, startHour: 16 }, now, PUBLIC),
    ).toThrow('already passed');
  });

  it('lets a walk-in take a Full Day until closing', () => {
    const now = at(`${MONDAY}T20:30`);
    expect(() =>
      rules.resolvePeriod({ tier: 'full_day', date: MONDAY, days: 1 }, now, PUBLIC),
    ).not.toThrow();
  });

  it('limits public bookings to 7 days out but not staff bookings', () => {
    const now = at(`${MONDAY}T09:00`);
    const lastDay = { tier: 'quick_job', date: '2026-10-19', startHour: 16 } as const;
    const tooFar = { tier: 'quick_job', date: '2026-10-20', startHour: 16 } as const;

    expect(() => rules.resolvePeriod(lastDay, now, PUBLIC)).not.toThrow();
    expect(() => rules.resolvePeriod(tooFar, now, PUBLIC)).toThrow('7 days');
    expect(() => rules.resolvePeriod(tooFar, now, STAFF)).not.toThrow();
  });

  it('applies the horizon to the last day of a multi-day booking', () => {
    const now = at(`${MONDAY}T09:00`);
    expect(() =>
      rules.resolvePeriod({ tier: 'full_day', date: '2026-10-18', days: 3 }, now, PUBLIC),
    ).toThrow('7 days');
  });
});

describe('periodsConflict', () => {
  const quickJob = { startAt: at(`${SATURDAY}T12:00`), endAt: at(`${SATURDAY}T13:30`) };

  it('keeps the bay closed for 30 minutes after a booking ends', () => {
    const inBuffer = { startAt: at(`${SATURDAY}T13:45`), endAt: at(`${SATURDAY}T15:45`) };
    const afterBuffer = { startAt: at(`${SATURDAY}T14:00`), endAt: at(`${SATURDAY}T16:00`) };

    expect(rules.periodsConflict(quickJob, inBuffer)).toBe(true);
    expect(rules.periodsConflict(quickJob, afterBuffer)).toBe(false);
  });

  it('needs the buffer before an existing booking too', () => {
    const before = { startAt: at(`${SATURDAY}T12:00`), endAt: at(`${SATURDAY}T14:00`) };
    const after = { startAt: at(`${SATURDAY}T14:00`), endAt: at(`${SATURDAY}T16:00`) };
    expect(rules.periodsConflict(after, before)).toBe(true);
  });
});

describe('requestFits', () => {
  const booked = [{ startAt: at(`${SATURDAY}T14:00`), endAt: at(`${SATURDAY}T16:00`) }];

  it('fits a request that clears the booking and its buffer', () => {
    const request = { tier: 'hourly', date: SATURDAY, startHour: 17, hours: 2 } as const;
    expect(rules.requestFits(request, booked, SUNDAY_BEFORE, PUBLIC)).toBe(true);
  });

  it('does not fit a request that runs into a booking', () => {
    const request = { tier: 'hourly', date: SATURDAY, startHour: 12, hours: 2 } as const;
    expect(rules.requestFits(request, booked, SUNDAY_BEFORE, PUBLIC)).toBe(false);
  });

  it('does not fit a Full Day on a day with any booking', () => {
    const request = { tier: 'full_day', date: SATURDAY, days: 1 } as const;
    expect(rules.requestFits(request, booked, SUNDAY_BEFORE, PUBLIC)).toBe(false);
  });

  it('does not fit a request that breaks a rule', () => {
    const request = { tier: 'hourly', date: SATURDAY, startHour: 20, hours: 2 } as const;
    expect(rules.requestFits(request, [], SUNDAY_BEFORE, PUBLIC)).toBe(false);
  });
});

describe('bookingLineItems', () => {
  const rates = DEFAULT_CAR_BAY_RATES;

  it('prices a Quick Job by membership', () => {
    const request = { tier: 'quick_job', date: MONDAY, startHour: 16 } as const;
    expect(lineItemsTotal(bookingLineItems(request, rates, true))).toBe(1200);
    expect(lineItemsTotal(bookingLineItems(request, rates, false))).toBe(1800);
  });

  it('prices Hourly per hour', () => {
    const request = { tier: 'hourly', date: SATURDAY, startHour: 12, hours: 3 } as const;
    expect(lineItemsTotal(bookingLineItems(request, rates, true))).toBe(3000);
    expect(lineItemsTotal(bookingLineItems(request, rates, false))).toBe(4500);
  });

  it('prices each Full Day at its own rate and adds a fee for each night between', () => {
    const request = { tier: 'full_day', date: FRIDAY, days: 3 } as const;
    const items = bookingLineItems(request, rates, true);

    expect(items.map((item) => item.unitAmount)).toEqual([2500, 4500, 4500, 3000]);
    expect(items.at(-1)?.quantity).toBe(2);
    expect(lineItemsTotal(items)).toBe(2500 + 4500 + 4500 + 2 * 3000);
  });

  it('adds no overnight fee to a single Full Day', () => {
    const items = bookingLineItems({ tier: 'full_day', date: MONDAY, days: 1 }, rates, false);
    expect(lineItemsTotal(items)).toBe(3800);
  });

  it('makes a weekday Full Day cheaper than Hourly past 2.5 hours', () => {
    const fullDay = bookingLineItems({ tier: 'full_day', date: MONDAY, days: 1 }, rates, true);
    const threeHours = bookingLineItems(
      { tier: 'hourly', date: MONDAY, startHour: 16, hours: 3 },
      rates,
      true,
    );
    expect(lineItemsTotal(fullDay)).toBeLessThan(lineItemsTotal(threeHours));
  });
});

describe('overrunLineItems', () => {
  const rates = DEFAULT_CAR_BAY_RATES;

  it('bills open-hours overrun per started hour', () => {
    const items = overrunLineItems({ kind: 'hourly', hours: 2 }, MONDAY, rates, false);
    expect(lineItemsTotal(items)).toBe(4000);
  });

  it('bills a flat overnight fee', () => {
    const items = overrunLineItems(
      { kind: 'overnight', nights: 1, extraDays: 0 },
      MONDAY,
      rates,
      true,
    );
    expect(lineItemsTotal(items)).toBe(3000);
  });

  it('adds the Full Day rate of each extra day after the booking', () => {
    const items = overrunLineItems(
      { kind: 'overnight', nights: 2, extraDays: 2 },
      FRIDAY,
      rates,
      true,
    );
    expect(lineItemsTotal(items)).toBe(2 * 3000 + 4500 + 4500);
  });

  it('rejects more extra days than nights', () => {
    expect(() =>
      overrunLineItems({ kind: 'overnight', nights: 1, extraDays: 2 }, FRIDAY, rates, true),
    ).toThrow(CarBayRuleError);
  });
});

describe('isRefundable', () => {
  const startAt = at(`${MONDAY}T16:00`);

  it('refunds up to 12 hours before the start', () => {
    expect(rules.isRefundable(startAt, at(`${MONDAY}T04:00`))).toBe(true);
    expect(rules.isRefundable(startAt, at(`${MONDAY}T04:01`))).toBe(false);
  });
});

describe('needsReminder', () => {
  const startAt = at(`${MONDAY}T16:00`);

  it('only reminds bookings made more than 24 hours ahead', () => {
    expect(rules.needsReminder(at('2026-10-11T15:00'), startAt)).toBe(true);
    expect(rules.needsReminder(at('2026-10-11T17:00'), startAt)).toBe(false);
  });
});

describe('clipToDay', () => {
  it('splits a multi-day booking into each day of the window', () => {
    const period = {
      startAt: rules.openWindow(FRIDAY).open,
      endAt: rules.openWindow(SATURDAY).close,
    };

    expect(rules.clipToDay(period, FRIDAY)?.start.toFormat('HH:mm')).toBe('16:00');
    expect(rules.clipToDay(period, SATURDAY)?.start.toFormat('HH:mm')).toBe('12:00');
    expect(rules.clipToDay(period, SUNDAY)).toBeNull();
  });

  it('includes the buffer after a booking', () => {
    const period = { startAt: at(`${MONDAY}T16:00`), endAt: at(`${MONDAY}T17:30`) };
    expect(rules.clipToDay(period, MONDAY)?.end.toFormat('HH:mm')).toBe('18:00');
  });
});

describe('custom policy', () => {
  const custom = new CarBayRules({
    ...DEFAULT_CAR_BAY_POLICY,
    weekdayOpenHour: 17,
    weekdayCloseHour: 22,
    quickJobMinutes: 60,
    hourlyMinHours: 3,
    bufferMinutes: 60,
    publicHorizonDays: 3,
  });

  it('uses the configured open hours', () => {
    expect(custom.slotHours(MONDAY)).toEqual([17, 18, 19, 20, 21]);
  });

  it('uses the configured Quick Job length and Hourly minimum', () => {
    const quickJob = custom.resolvePeriod(
      { tier: 'quick_job', date: MONDAY, startHour: 17 },
      SUNDAY_BEFORE,
      PUBLIC,
    );
    expect(quickJob.endAt.toFormat('HH:mm')).toBe('18:00');
    expect(() =>
      custom.resolvePeriod(
        { tier: 'hourly', date: MONDAY, startHour: 17, hours: 2 },
        SUNDAY_BEFORE,
        PUBLIC,
      ),
    ).toThrow('at least 3 hours');
  });

  it('uses the configured buffer and horizon', () => {
    const booked = { startAt: at(`${MONDAY}T17:00`), endAt: at(`${MONDAY}T18:00`) };
    const next = { startAt: at(`${MONDAY}T18:30`), endAt: at(`${MONDAY}T19:30`) };
    expect(custom.periodsConflict(booked, next)).toBe(true);
    expect(() =>
      custom.resolvePeriod(
        { tier: 'quick_job', date: '2026-10-15', startHour: 17 },
        SUNDAY_BEFORE,
        PUBLIC,
      ),
    ).toThrow('3 days');
  });
});

describe('separate weekday and weekend closing', () => {
  const custom = new CarBayRules({ ...DEFAULT_CAR_BAY_POLICY, weekendCloseHour: 18 });

  it('closes each day at its own time', () => {
    expect(custom.openWindow(MONDAY).close.toFormat('HH:mm')).toBe('21:00');
    expect(custom.openWindow(SATURDAY).close.toFormat('HH:mm')).toBe('18:00');
    expect(custom.slotHours(SATURDAY)).toEqual([12, 13, 14, 15, 16, 17]);
  });
});

describe('overnight fee by membership', () => {
  const rates = {
    ...DEFAULT_CAR_BAY_RATES,
    overnightFee: { member: 3000, nonMember: 4500 },
  };

  it('charges the non-member overnight fee to non-members', () => {
    const items = overrunLineItems(
      { kind: 'overnight', nights: 1, extraDays: 0 },
      MONDAY,
      rates,
      false,
    );
    expect(lineItemsTotal(items)).toBe(4500);
  });

  it('charges the member overnight fee between multi-day Full Days', () => {
    const items = bookingLineItems({ tier: 'full_day', date: FRIDAY, days: 2 }, rates, true);
    expect(items.at(-1)?.unitAmount).toBe(3000);
  });
});
