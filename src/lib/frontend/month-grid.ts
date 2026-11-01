import type { DateTime } from 'luxon';

export const DAYS_IN_WEEK = 7;

/** Days since Sunday, which starts each row. Luxon numbers Sunday 7. */
function dayOfWeek(date: DateTime) {
  return date.weekday % DAYS_IN_WEEK;
}

/** Every day shown on a month calendar: whole weeks, Sunday to Saturday, covering the month. */
export function monthGridDays(month: DateTime) {
  const monthStart = month.startOf('month');
  const monthEnd = month.endOf('month').startOf('day');
  const gridStart = monthStart.minus({ days: dayOfWeek(monthStart) });
  const gridEnd = monthEnd.plus({ days: DAYS_IN_WEEK - 1 - dayOfWeek(monthEnd) });
  const dayCount = Math.round(gridEnd.diff(gridStart, 'days').days) + 1;

  return Array.from({ length: dayCount }, (_, offset) => gridStart.plus({ days: offset }));
}
