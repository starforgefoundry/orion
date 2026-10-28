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

type ClassSchedule = { date: string; startTime: string; durationMinutes: number };

export function classStartsAt(instance: Pick<ClassSchedule, 'date' | 'startTime'>) {
  return DateTime.fromISO(`${instance.date}T${instance.startTime}`, { zone: SPACE_ZONE });
}

export function classEndsAt(instance: ClassSchedule) {
  return classStartsAt(instance).plus({ minutes: instance.durationMinutes });
}
