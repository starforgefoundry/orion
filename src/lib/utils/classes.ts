import { SPACE_ZONE } from '$lib/space';
import { DateTime } from 'luxon';

export const CLASS_INSTANCE_STATUS = {
  SCHEDULED: 'scheduled',
  CANCELED: 'canceled',
} as const;

export const CLASS_BOOKING_STATUS = {
  CONFIRMED: 'confirmed',
  CANCELED: 'canceled',
} as const;

export const CLASS_DATE_FORMAT = 'EEEE, MMMM d, yyyy';
const CLASS_TIME_FORMAT = 'h:mm a';

type ClassSchedule = { date: string; startTime: string; durationMinutes: number };

export function classStartsAt(instance: Pick<ClassSchedule, 'date' | 'startTime'>) {
  return DateTime.fromISO(`${instance.date}T${instance.startTime}`, { zone: SPACE_ZONE });
}

export function formatClassTime(instance: Pick<ClassSchedule, 'date' | 'startTime'>) {
  return classStartsAt(instance).toFormat(CLASS_TIME_FORMAT);
}

export function classEndsAt(instance: ClassSchedule) {
  return classStartsAt(instance).plus({ minutes: instance.durationMinutes });
}
