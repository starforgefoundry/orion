import type { Waiver } from '$lib/server/db/schema';
import * as v from 'valibot';

export const submitWaiverDto = v.object({
  firstName: v.pipe(v.string(), v.minLength(1)),
  lastName: v.pipe(v.string(), v.minLength(1)),
  email: v.pipe(v.string(), v.email()),
  signature: v.pipe(v.string(), v.minLength(1)),
});

export type SubmitWaiverDto = v.InferInput<typeof submitWaiverDto>;

export const searchWaiversDto = v.object({
  query: v.optional(v.string(), ''),
  page: v.optional(v.number(), 1),
  pageSize: v.optional(v.number(), 25),
});

export type SearchWaiversDto = v.InferInput<typeof searchWaiversDto>;

export type WaiverDto = Waiver;
