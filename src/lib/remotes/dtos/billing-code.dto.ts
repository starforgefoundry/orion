import * as v from 'valibot';

export const createBillingCodeDto = v.object({
  code: v.pipe(v.string(), v.trim(), v.nonEmpty()),
  description: v.pipe(v.string(), v.trim(), v.nonEmpty()),
  organizationId: v.pipe(v.string(), v.nonEmpty()),
});

export type CreateBillingCodeDto = v.InferInput<typeof createBillingCodeDto>;

export const updateBillingCodeDto = v.object({
  id: v.string(),
  code: v.optional(v.string()),
  description: v.optional(v.string()),
  archived: v.optional(v.boolean()),
});

export type UpdateBillingCodeDto = v.InferInput<typeof updateBillingCodeDto>;
