import * as v from 'valibot';

export const createOrgChargeDto = v.object({
  organizationId: v.string(),
  description: v.string(),
  amount: v.number(), // in cents
});

export type CreateOrgChargeDto = v.InferInput<typeof createOrgChargeDto>;
