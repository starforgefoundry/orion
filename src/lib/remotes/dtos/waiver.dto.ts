import type { Waiver } from '$lib/server/db/schema';
import * as v from 'valibot';

export const submitWaiverDto = v.object({
  name: v.pipe(v.string(), v.minLength(1)),
  email: v.pipe(v.string(), v.email()),
  signature: v.file(),
  isAdult: v.pipe(
    v.optional(v.boolean(), false),
    v.check((isAdult) => isAdult, 'You must be 18 or older to use the space'),
  ),
});

export type SubmitWaiverDto = v.InferOutput<typeof submitWaiverDto>;

export const searchWaiversDto = v.object({
  query: v.optional(v.string(), ''),
  page: v.optional(v.number(), 1),
  pageSize: v.optional(v.number(), 25),
});

export type SearchWaiversDto = v.InferInput<typeof searchWaiversDto>;

export type WaiverDto = Waiver;
