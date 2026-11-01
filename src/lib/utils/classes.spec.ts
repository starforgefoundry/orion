import { describe, expect, it } from 'vitest';
import { weeklyDates } from './classes';

const SUNDAY = 0;
const WEDNESDAY = 3;

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
