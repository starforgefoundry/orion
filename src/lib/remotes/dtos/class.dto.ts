import type { ClassCatalog, ClassInstance, User } from '$lib/server/db/schema';
import * as v from 'valibot';

// ── Catalog ──

export const upsertCatalogDto = v.object({
  id: v.optional(v.string()),
  name: v.pipe(v.string(), v.minLength(1)),
  description: v.pipe(v.string(), v.minLength(1)),
  price: v.pipe(v.number(), v.minValue(0)), // in cents
  photo: v.optional(v.file()),
});

export type UpsertCatalogDto = v.InferInput<typeof upsertCatalogDto>;

// ── Instance ──

export const generateInstancesDto = v.object({
  classId: v.string(),
  teacherEmail: v.pipe(v.string(), v.email()),
  dayOfWeek: v.pipe(v.number(), v.minValue(0), v.maxValue(6)),
  startTime: v.string(), // HH:mm
  durationMinutes: v.pipe(v.number(), v.minValue(1)),
  seats: v.pipe(v.number(), v.minValue(1)),
  startDate: v.string(), // YYYY-MM-DD
  endDate: v.string(), // YYYY-MM-DD
});

export type GenerateInstancesDto = v.InferInput<typeof generateInstancesDto>;

export const createInstanceDto = v.object({
  classId: v.string(),
  teacherEmail: v.pipe(v.string(), v.email()),
  date: v.string(), // YYYY-MM-DD
  startTime: v.string(), // HH:mm
  durationMinutes: v.pipe(v.number(), v.minValue(1)),
  seats: v.pipe(v.number(), v.minValue(1)),
});

export type CreateInstanceDto = v.InferInput<typeof createInstanceDto>;

export const updateInstanceDto = v.object({
  id: v.string(),
  teacherEmail: v.optional(v.pipe(v.string(), v.email())),
  date: v.optional(v.string()),
  startTime: v.optional(v.string()),
  durationMinutes: v.optional(v.pipe(v.number(), v.minValue(1))),
  seats: v.optional(v.pipe(v.number(), v.minValue(1))),
});

export type UpdateInstanceDto = v.InferInput<typeof updateInstanceDto>;

export const cancelInstanceDto = v.object({
  instanceId: v.string(),
  mode: v.picklist(['single', 'this_and_future']),
});

export type CancelInstanceDto = v.InferInput<typeof cancelInstanceDto>;

// ── Booking ──

export const bookClassDto = v.object({
  instanceId: v.string(),
  customerName: v.pipe(v.string(), v.minLength(1)),
  customerEmail: v.pipe(v.string(), v.email()),
  customerPhone: v.pipe(v.string(), v.minLength(1)),
  quantity: v.pipe(v.number(), v.minValue(1)),
  sourceId: v.string(), // Square payment nonce
});

export type BookClassDto = v.InferInput<typeof bookClassDto>;

export const cancelBookingDto = v.object({
  bookingToken: v.string(),
});

export type CancelBookingDto = v.InferInput<typeof cancelBookingDto>;

export const cancelBookingStaffDto = v.object({
  bookingId: v.string(),
});

export type CancelBookingStaffDto = v.InferInput<typeof cancelBookingStaffDto>;

export const rescheduleBookingDto = v.object({
  bookingId: v.string(),
  targetInstanceId: v.string(),
});

export type RescheduleBookingDto = v.InferInput<typeof rescheduleBookingDto>;

export const manualBookClassDto = v.object({
  instanceId: v.string(),
  customerName: v.pipe(v.string(), v.minLength(1)),
  customerEmail: v.pipe(v.string(), v.email()),
  customerPhone: v.pipe(v.string(), v.minLength(1)),
  quantity: v.pipe(v.number(), v.minValue(1)),
});

export type ManualBookClassDto = v.InferInput<typeof manualBookClassDto>;

// ── Composite Types ──

/**
 * The subset of teacher info safe to return to unauthenticated callers (the
 * public class catalog / booking pages). Keeps email, ical token, and
 * Google Calendar identifiers out of public responses.
 */
export type PublicTeacher = Pick<User, 'name' | 'picture'>;

export type ClassInstanceWithDetails = ClassInstance & {
  teacher: User | null;
  catalog: ClassCatalog | null;
  confirmedCount: number;
};

export type PublicClassInstance = ClassInstance & {
  teacher: PublicTeacher | null;
  confirmedCount: number;
};

export type ClassCatalogWithInstances = ClassCatalog & {
  instances: PublicClassInstance[];
};
