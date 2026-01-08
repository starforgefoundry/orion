import { command, form, query } from '$app/server';
import {
  chargeOrganizationBalanceDto,
  createOrganizationDto,
  updateOrganizationDto,
} from '$lib/remotes/dtos/organization.dto';
import { verifyAuth } from '$lib/remotes/utils';
import { organizationService } from '$lib/server/services/organization.service';
import * as v from 'valibot';

export const getOrganizations = query(async () => {
  verifyAuth();
  return await organizationService.getOrganizations();
});

export const getOrganizationById = query(v.object({ id: v.string() }), async (dto) => {
  verifyAuth();
  return await organizationService.getOrganizationById(dto.id);
});

export const getOrganizationDetail = query(v.object({ id: v.string() }), async (dto) => {
  verifyAuth();
  return await organizationService.getOrganizationDetail(dto.id);
});

export const createOrganization = command(createOrganizationDto, async (data) => {
  verifyAuth();
  const organization = await organizationService.createOrganization(data);
  await getOrganizations().refresh();
  return organization;
});

export const createOrganizationForm = form(createOrganizationDto, async (data) => {
  verifyAuth();
  const organization = await organizationService.createOrganization(data);
  await getOrganizations().refresh();
  return organization;
});

export const updateOrganization = command(updateOrganizationDto, async (dto) => {
  verifyAuth();
  const { id, ...updates } = dto;
  const organization = await organizationService.updateOrganization(id, updates);
  await getOrganizations().refresh();
  return organization;
});

export const archiveOrganization = command(v.object({ id: v.string() }), async (dto) => {
  verifyAuth();
  await organizationService.archiveOrganization(dto.id);
  await getOrganizations().refresh();
});

export const chargeOrganizationBalance = command(chargeOrganizationBalanceDto, async (dto) => {
  verifyAuth();
  const payment = await organizationService.chargeOrganizationBalance(dto);
  await getOrganizationDetail({ id: dto.organizationId }).refresh();
  return payment;
});
