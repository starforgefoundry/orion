import { command, form, query } from '$app/server';
import { createBillingCodeDto, updateBillingCodeDto } from '$lib/remotes/dtos/billing-code.dto';
import { staffOnly } from '$lib/server/remote-utils';
import { billingCodeService } from '$lib/server/services/billing-code.service';
import * as v from 'valibot';

export const getBillingCodes = query(staffOnly(() => billingCodeService.getBillingCodes()));

export const getBillingCodesForOrganization = query(
  v.string(),
  staffOnly((organizationId) => billingCodeService.getBillingCodesForOrganization(organizationId)),
);

async function refreshCodes(organizationId: string | null) {
  await Promise.all([
    getBillingCodes().refresh(),
    organizationId && getBillingCodesForOrganization(organizationId).refresh(),
  ]);
}

export const createBillingCode = form(
  createBillingCodeDto,
  staffOnly(async (data) => {
    const code = await billingCodeService.createBillingCode(data);
    await refreshCodes(code.organizationId);
    return code;
  }),
);

export const updateBillingCode = command(
  updateBillingCodeDto,
  staffOnly(async (dto) => {
    const { id, ...updates } = dto;
    const code = await billingCodeService.updateBillingCode(id, updates);
    await refreshCodes(code.organizationId);
    return code;
  }),
);
