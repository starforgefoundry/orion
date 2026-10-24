import type { CarBayBooking, CarBayClosure } from '$lib/server/db/schema';
import { DateTime } from 'luxon';
import { newId } from './id';

export function carBayBooking(overrides: Partial<CarBayBooking> = {}): CarBayBooking {
  const startAt = DateTime.now().plus({ days: 1 }).startOf('hour');
  const endAt = startAt.plus({ hours: 1 });
  return {
    id: newId(),
    tier: 'hourly',
    status: 'confirmed',
    startAt,
    endAt,
    blockedUntil: endAt,
    isMember: true,
    customerName: 'Test Customer',
    customerEmail: 'customer@example.com',
    customerPhone: '555-0100',
    amountPaid: 0,
    squarePaymentId: null,
    squareOrderId: null,
    createdByEmail: null,
    bookingToken: newId(),
    reminderSentDate: null,
    createdDate: DateTime.now(),
    ...overrides,
  };
}

export function carBayClosure(overrides: Partial<CarBayClosure> = {}): CarBayClosure {
  const startAt = DateTime.now().plus({ days: 1 }).startOf('day');
  return {
    id: newId(),
    startAt,
    endAt: startAt.endOf('day'),
    reason: null,
    createdByEmail: null,
    createdDate: DateTime.now(),
    ...overrides,
  };
}
