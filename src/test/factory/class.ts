import type {
  ClassBooking,
  ClassCatalog,
  ClassInstance,
  Payment,
  User,
} from '$lib/server/db/schema';
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

export function classInstanceDetail(
  overrides: Partial<ClassInstance> = {},
  catalog: ClassCatalog | null = classCatalog(),
  teacher: User | null = null,
) {
  return { ...classInstance(overrides), teacher, catalog };
}

export function classBookingWithPayment(
  overrides: Partial<ClassBooking> = {},
  payment: Payment | null = null,
) {
  return { ...classBooking(overrides), payment };
}

export function classBookingDetail(
  overrides: Partial<ClassBooking> = {},
  payment: Payment | null = null,
  instance: ClassInstance | null = classInstance(),
  catalog: ClassCatalog | null = classCatalog(),
) {
  return { ...classBookingWithPayment(overrides, payment), instance, catalog };
}
