import { command, form, query } from '$app/server';
import { createBillingCodeDto, updateBillingCodeDto } from '$lib/remotes/dtos/billing_code.dto';
import { verifyAuth } from '$lib/remotes/utils';
import { billingCodeService } from '$lib/server/services/billing_code.service';
import * as v from 'valibot';

export const getBillingCodes = query(async () => {
  verifyAuth();
  return await billingCodeService.getBillingCodes();
});

export const getBillingCodeById = query(v.object({ id: v.string() }), async (dto) => {
  verifyAuth();
  return await billingCodeService.getBillingCodeById(dto.id);
});

export const getBillingCodeByCode = query(v.object({ code: v.string() }), async (dto) => {
  // This can be used publicly to validate codes on the print request form
  return await billingCodeService.getBillingCodeByCode(dto.code);
});

export const createBillingCode = form(createBillingCodeDto, async (data) => {
  verifyAuth();
  const code = await billingCodeService.createBillingCode(data);
  await getBillingCodes().refresh();
  return code;
});

export const updateBillingCode = command(updateBillingCodeDto, async (dto) => {
  verifyAuth();
  const { id, ...updates } = dto;
  const code = await billingCodeService.updateBillingCode(id, updates);
  await getBillingCodes().refresh();
  return code;
});

export const deleteBillingCode = command(v.object({ id: v.string() }), async (dto) => {
  verifyAuth();
  await billingCodeService.deleteBillingCode(dto.id);
  await getBillingCodes().refresh();
});
