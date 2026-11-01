import { SPACE_ZONE } from '$lib/utils/space';
import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import { classEndsAt, classHasStarted, classStartsAt, weeklyDates } from './classes';

const SUNDAY = 0;
const WEDNESDAY = 3;

const CLASS = { date: '2026-10-16', startTime: '18:00', durationMinutes: 90 };
const STARTS_AT = DateTime.fromISO('2026-10-16T18:00', { zone: SPACE_ZONE });

describe(classStartsAt.name, () => {
  it('reads the date and start time at the space', () => {
    expect(classStartsAt(CLASS).toISO()).toBe(STARTS_AT.toISO());
  });
});

describe(classEndsAt.name, () => {
  it('adds the duration to the start', () => {
    expect(classEndsAt(CLASS).toISO()).toBe(STARTS_AT.plus({ minutes: 90 }).toISO());
  });
});

describe(classHasStarted.name, () => {
  it('is false before the start', () => {
    expect(classHasStarted(CLASS, STARTS_AT.minus({ minutes: 1 }))).toBe(false);
  });

  it('is true from the start onwards', () => {
    expect(classHasStarted(CLASS, STARTS_AT)).toBe(true);
  });

  it('compares instants, not wall clock times in another zone', () => {
    const justBeforeInUtc = STARTS_AT.minus({ minutes: 1 }).toUTC();

    expect(classHasStarted(CLASS, justBeforeInUtc)).toBe(false);
  });
});

describe(weeklyDates.name, () => {
  it('lists each matching weekday, including the end date', () => {
    expect(weeklyDates('2026-10-01', '2026-10-21', WEDNESDAY)).toEqual([
      '2026-10-07',
      '2026-10-14',
      '2026-10-21',
    ]);
  });

  it('treats 0 as Sunday', () => {
    expect(weeklyDates('2026-10-01', '2026-10-12', SUNDAY)).toEqual(['2026-10-04', '2026-10-11']);
  });

  it('lists nothing when the range has no matching day', () => {
    expect(weeklyDates('2026-10-05', '2026-10-06', SUNDAY)).toEqual([]);
  });
});
