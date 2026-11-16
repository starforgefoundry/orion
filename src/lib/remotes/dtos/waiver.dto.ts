import { pageFields } from '$lib/remotes/dtos/pagination.dto';
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
  ...pageFields(),
});

export type SearchWaiversDto = v.InferOutput<typeof searchWaiversDto>;
