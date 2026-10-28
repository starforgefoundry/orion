import type { ClassBooking, ClassCatalog, ClassInstance } from '$lib/server/db/schema';
import { DateTime } from 'luxon';
import { newId } from './id';

export function classCatalog(overrides: Partial<ClassCatalog> = {}): ClassCatalog {
  return {
    id: newId(),
    name: 'Intro to 3D Printing',
    description: 'Learn the basics',
    price: 2500,
    photoUrl: null,
    createdDate: DateTime.now(),
    ...overrides,
  };
}

export function classInstance(overrides: Partial<ClassInstance> = {}): ClassInstance {
  return {
    id: newId(),
    classId: newId(),
    teacherEmail: 'teacher@example.com',
    date: DateTime.now().plus({ weeks: 1 }).toISODate()!,
    startTime: '18:00',
    durationMinutes: 120,
    seats: 10,
    status: 'scheduled',
    recurrenceGroupId: null,
    createdDate: DateTime.now(),
    googleEventId: null,
    ...overrides,
  };
}

export function classBooking(overrides: Partial<ClassBooking> = {}): ClassBooking {
  return {
    id: newId(),
    instanceId: newId(),
    customerName: 'Test Customer',
    customerEmail: 'customer@example.com',
    customerPhone: '555-0100',
    status: 'confirmed',
    bookingToken: newId(),
    quantity: 1,
    paymentId: null,
    memberId: null,
    passToken: newId(),
    reminderSentDate: null,
    createdDate: DateTime.now(),
    ...overrides,
  };
}
