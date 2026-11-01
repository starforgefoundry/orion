import { command, form, query } from '$app/server';
import { createBillingCodeDto, updateBillingCodeDto } from '$lib/remotes/dtos/billing_code.dto';
import { exposeUserErrors, verifyAuth } from '$lib/remotes/utils';
import { billingCodeService } from '$lib/server/services/billing_code.service';
import * as v from 'valibot';

export const getBillingCodes = query(
  exposeUserErrors(async () => {
    verifyAuth();
    return await billingCodeService.getBillingCodes();
  }),
);

export const getBillingCodesForOrganization = query(
  v.string(),
  exposeUserErrors(async (organizationId) => {
    verifyAuth();
    return await billingCodeService.getBillingCodesForOrganization(organizationId);
  }),
);

async function refreshCodes(organizationId: string | null) {
  await Promise.all([
    getBillingCodes().refresh(),
    organizationId && getBillingCodesForOrganization(organizationId).refresh(),
  ]);
}

export const createBillingCode = form(
  createBillingCodeDto,
  exposeUserErrors(async (data) => {
    verifyAuth();
    const code = await billingCodeService.createBillingCode(data);
    await refreshCodes(code.organizationId);
    return code;
  }),
);

export const updateBillingCode = command(
  updateBillingCodeDto,
  exposeUserErrors(async (dto) => {
    verifyAuth();
    const { id, ...updates } = dto;
    const code = await billingCodeService.updateBillingCode(id, updates);
    await refreshCodes(code.organizationId);
    return code;
  }),
);
