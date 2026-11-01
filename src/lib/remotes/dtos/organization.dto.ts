import * as v from 'valibot';

export const createOrganizationDto = v.object({
  name: v.string(),
  email: v.pipe(v.string(), v.email()),
});

export type CreateOrganizationDto = v.InferInput<typeof createOrganizationDto>;

export const updateOrganizationDto = v.object({
  id: v.string(),
  name: v.optional(v.string()),
  email: v.optional(v.pipe(v.string(), v.email())),
  grantsAccess: v.optional(v.boolean()),
  /** Last day of member access (YYYY-MM-DD, space time zone); null removes the limit. */
  accessEndDate: v.optional(v.nullable(v.pipe(v.string(), v.isoDate()))),
});

export type UpdateOrganizationDto = v.InferInput<typeof updateOrganizationDto>;

export const addOrganizationMembersDto = v.object({
  organizationId: v.string(),
  lines: v.string(),
});

export type AddOrganizationMembersDto = v.InferInput<typeof addOrganizationMembersDto>;

export const removeOrganizationMembersDto = v.object({
  organizationId: v.string(),
  membershipIds: v.pipe(v.array(v.string()), v.minLength(1)),
});

export const chargeOrganizationBalanceDto = v.object({
  organizationId: v.string(),
});

export type ChargeOrganizationBalanceDto = v.InferInput<typeof chargeOrganizationBalanceDto>;
