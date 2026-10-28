import { command, form, query } from '$app/server';
import { createBillingCodeDto, updateBillingCodeDto } from '$lib/remotes/dtos/billing_code.dto';
import { verifyAuth } from '$lib/remotes/utils';
import {
  billingCodeService,
  BillingCodeTakenError,
} from '$lib/server/services/billing_code.service';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';

const CONFLICT = 409;

export const getBillingCodes = query(async () => {
  verifyAuth();
  return await billingCodeService.getBillingCodes();
});

export const getBillingCodesForOrganization = query(v.string(), async (organizationId) => {
  verifyAuth();
  return await billingCodeService.getBillingCodesForOrganization(organizationId);
});

export const getBillingCodeById = query(v.object({ id: v.string() }), async (dto) => {
  verifyAuth();
  return await billingCodeService.getBillingCodeById(dto.id);
});

async function refreshCodes(organizationId: string | null) {
  await Promise.all([
    getBillingCodes().refresh(),
    organizationId && getBillingCodesForOrganization(organizationId).refresh(),
  ]);
}

export const createBillingCode = form(createBillingCodeDto, async (data) => {
  verifyAuth();
  try {
    const code = await billingCodeService.createBillingCode(data);
    await refreshCodes(code.organizationId);
    return code;
  } catch (cause) {
    if (cause instanceof BillingCodeTakenError) error(CONFLICT, cause.message);
    throw cause;
  }
});

export const updateBillingCode = command(updateBillingCodeDto, async (dto) => {
  verifyAuth();
  const { id, ...updates } = dto;
  const code = await billingCodeService.updateBillingCode(id, updates);
  await refreshCodes(code.organizationId);
  return code;
});

export const deleteBillingCode = command(v.object({ id: v.string() }), async (dto) => {
  verifyAuth();
  const code = await billingCodeService.getBillingCodeById(dto.id);
  await billingCodeService.deleteBillingCode(dto.id);
  await refreshCodes(code.organizationId);
});
