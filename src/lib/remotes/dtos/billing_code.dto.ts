import * as v from 'valibot';

export const billingCodeDto = v.object({
  id: v.string(),
  code: v.string(),
  description: v.string(),
  organizationId: v.optional(v.string(), ''),
  discountId: v.optional(v.string(), ''),
  archived: v.boolean(),
});

export type BillingCodeDto = v.InferInput<typeof billingCodeDto>;

export const createBillingCodeDto = v.object({
  code: v.string(),
  description: v.string(),
  organizationId: v.optional(v.string(), ''),
  discountId: v.optional(v.string(), ''),
  archived: v.optional(v.boolean(), false),
});

export type CreateBillingCodeDto = v.InferInput<typeof createBillingCodeDto>;

export const updateBillingCodeDto = v.object({
  id: v.string(),
  code: v.optional(v.string()),
  description: v.optional(v.string()),
  organizationId: v.optional(v.string()),
  discountId: v.optional(v.string()),
  archived: v.optional(v.boolean()),
});

export type UpdateBillingCodeDto = v.InferInput<typeof updateBillingCodeDto>;

export const billingCodeWithDetailsDto = v.object({
  id: v.string(),
  code: v.string(),
  description: v.string(),
  organizationId: v.optional(v.string(), ''),
  organizationName: v.optional(v.string(), ''),
  discountId: v.optional(v.string(), ''),
  discountName: v.optional(v.string(), ''),
  archived: v.boolean(),
});

export type BillingCodeWithDetailsDto = v.InferInput<typeof billingCodeWithDetailsDto>;
