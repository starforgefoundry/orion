import { SPACE_ZONE } from '$lib/utils/space';
import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import { DAYS_IN_WEEK, monthGridDays } from './month-grid';

function month(iso: string) {
  return DateTime.fromISO(iso, { zone: SPACE_ZONE });
}

function isoDates(days: DateTime[]) {
  return days.map((day) => day.toISODate());
}

describe(monthGridDays.name, () => {
  it('pads the month out to whole Sunday-to-Saturday weeks', () => {
    // October 2026 starts on a Thursday and ends on a Saturday.
    const days = monthGridDays(month('2026-10-14'));

    expect(days).toHaveLength(5 * DAYS_IN_WEEK);
    expect(days[0].toISODate()).toBe('2026-09-27');
    expect(days.at(-1)!.toISODate()).toBe('2026-10-31');
  });

  it('adds no padding to a month that fills whole weeks', () => {
    // February 2026 starts on a Sunday and ends on a Saturday.
    const days = monthGridDays(month('2026-02-01'));

    expect(isoDates(days)).toHaveLength(4 * DAYS_IN_WEEK);
    expect(days[0].toISODate()).toBe('2026-02-01');
    expect(days.at(-1)!.toISODate()).toBe('2026-02-28');
  });

  it('lists each day once across a daylight saving change', () => {
    const dates = isoDates(monthGridDays(month('2026-11-01')));

    expect(new Set(dates).size).toBe(dates.length);
    expect(dates).toContain('2026-11-01');
    expect(dates).toContain('2026-11-02');
    expect(dates.at(-1)).toBe('2026-12-05');
  });
});
