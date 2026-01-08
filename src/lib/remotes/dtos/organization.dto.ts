import * as v from 'valibot';

export const organizationDto = v.object({
  id: v.string(),
  name: v.string(),
  email: v.string(),
});

export type OrganizationDto = v.InferInput<typeof organizationDto>;

export const createOrganizationDto = v.object({
  name: v.string(),
  email: v.pipe(v.string(), v.email()),
});

export type CreateOrganizationDto = v.InferInput<typeof createOrganizationDto>;

export const updateOrganizationDto = v.object({
  id: v.string(),
  name: v.optional(v.string()),
  email: v.optional(v.pipe(v.string(), v.email())),
});

export type UpdateOrganizationDto = v.InferInput<typeof updateOrganizationDto>;

export const organizationDetailDto = v.object({
  id: v.string(),
  name: v.string(),
  email: v.string(),
  outstandingBalance: v.number(),
  charges: v.array(
    v.object({
      id: v.string(),
      description: v.string(),
      date: v.string(),
      amount: v.number(),
      status: v.string(),
      type: v.union([v.literal('print'), v.literal('charge')]),
    }),
  ),
  balancePayments: v.array(
    v.object({
      id: v.string(),
      issuedDate: v.string(),
      paymentDate: v.optional(v.nullable(v.string())),
      total: v.number(),
      status: v.string(),
      squareInvoiceId: v.optional(v.nullable(v.string())),
    }),
  ),
});

export type OrganizationDetailDto = v.InferInput<typeof organizationDetailDto>;

export const chargeOrganizationBalanceDto = v.object({
  organizationId: v.string(),
});

export type ChargeOrganizationBalanceDto = v.InferInput<typeof chargeOrganizationBalanceDto>;
