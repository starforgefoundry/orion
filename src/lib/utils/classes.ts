// Relative imports: the database schema and seed script load this file outside SvelteKit.
import { SPACE_ZONE } from '../space.ts';
import { DateTime, Interval } from 'luxon';

export const CLASS_INSTANCE_STATUS = {
  SCHEDULED: 'scheduled',
  CANCELED: 'canceled',
} as const;

export const CLASS_BOOKING_STATUS = {
  CONFIRMED: 'confirmed',
  CANCELED: 'canceled',
} as const;

export const CANCEL_INSTANCE_MODE = {
  SINGLE: 'single',
  THIS_AND_FUTURE: 'this_and_future',
} as const;

export const CLASS_DATE_FORMAT = 'EEEE, MMMM d, yyyy';
export const CLASS_SHORT_DATE_FORMAT = 'MMM d, yyyy';
const CLASS_TIME_FORMAT = 'h:mm a';

/** The schedule form numbers days from 0 (Sunday); Luxon numbers Sunday 7. */
const FORM_SUNDAY = 0;
const LUXON_SUNDAY = 7;

type ClassSchedule = { date: string; startTime: string; durationMinutes: number };

export function classStartsAt(instance: Pick<ClassSchedule, 'date' | 'startTime'>) {
  return DateTime.fromISO(`${instance.date}T${instance.startTime}`, { zone: SPACE_ZONE });
}

export function classHasStarted(
  instance: Pick<ClassSchedule, 'date' | 'startTime'>,
  now: DateTime = DateTime.now(),
) {
  return classStartsAt(instance) <= now;
}

export function formatClassTime(instance: Pick<ClassSchedule, 'date' | 'startTime'>) {
  return classStartsAt(instance).toFormat(CLASS_TIME_FORMAT);
}

export function classEndsAt(instance: ClassSchedule) {
  return classStartsAt(instance).plus({ minutes: instance.durationMinutes });
}

/** Every date from `startDate` through `endDate` that falls on `dayOfWeek` (0 is Sunday). */
export function weeklyDates(startDate: string, endDate: string, dayOfWeek: number) {
  const weekday = dayOfWeek === FORM_SUNDAY ? LUXON_SUNDAY : dayOfWeek;
  const start = DateTime.fromISO(startDate, { zone: SPACE_ZONE });
  const afterEnd = DateTime.fromISO(endDate, { zone: SPACE_ZONE }).plus({ days: 1 });
  return Interval.fromDateTimes(start, afterEnd)
    .splitBy({ days: 1 })
    .map((day) => day.start!)
    .filter((day) => day.weekday === weekday)
    .map((day) => day.toISODate()!);
}
