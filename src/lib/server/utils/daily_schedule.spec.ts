import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import { nextDailyRun } from './daily_schedule';

const ZONE = 'America/Chicago';
const HOUR = 3;

function at(iso: string) {
  return DateTime.fromISO(iso, { zone: ZONE });
}

describe('nextDailyRun', () => {
  it('runs later today when the hour has not passed', () => {
    expect(nextDailyRun(at('2026-10-16T01:00'), HOUR, ZONE).toISO()).toBe(
      '2026-10-16T03:00:00.000-05:00',
    );
  });

  it('runs tomorrow when the hour has passed', () => {
    expect(nextDailyRun(at('2026-10-16T03:00'), HOUR, ZONE).toISO()).toBe(
      '2026-10-17T03:00:00.000-05:00',
    );
  });

  it('keeps the local hour across a daylight saving change', () => {
    expect(nextDailyRun(at('2026-11-01T12:00'), HOUR, ZONE).toISO()).toBe(
      '2026-11-02T03:00:00.000-06:00',
    );
  });

  it('works from a server clock in UTC', () => {
    const utcNow = DateTime.fromISO('2026-10-16T09:00Z', { zone: 'utc' });

    expect(nextDailyRun(utcNow, HOUR, ZONE).toISO()).toBe('2026-10-17T03:00:00.000-05:00');
  });
});
