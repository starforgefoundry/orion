import { luxonDatetime } from '$lib/remotes/dtos/utils';
import * as v from 'valibot';

export const orgCharge = v.object({
  id: v.string(),
  organizationId: v.string(),
  creationDate: luxonDatetime,
  description: v.string(),
  amount: v.number(), // in cents
});

export type OrgChargeDto = v.InferInput<typeof orgCharge>;

export const createOrgChargeDto = v.object({
  organizationId: v.string(),
  description: v.string(),
  amount: v.number(), // in cents
});

export type CreateOrgChargeDto = v.InferInput<typeof createOrgChargeDto>;

export const updateOrgChargeDto = v.object({
  id: v.string(),
  organizationId: v.optional(v.string()),
  description: v.optional(v.string()),
  amount: v.optional(v.number()), // in cents
});

export type UpdateOrgChargeDto = v.InferInput<typeof updateOrgChargeDto>;
