import { command, form, query } from '$app/server';
import {
  addOrganizationMembersDto,
  chargeOrganizationBalanceDto,
  createOrganizationDto,
  removeOrganizationMembersDto,
  updateOrganizationDto,
} from '$lib/remotes/dtos/organization.dto';
import { createOrgChargeDto } from '$lib/remotes/dtos/organization_charges.dto';
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
  const payment = await organizationService.chargeBalance(dto);
  await getOrganizationDetail({ id: dto.organizationId }).refresh();
  return payment;
});

export const createOrganizationChargeForm = form(createOrgChargeDto, async (dto) => {
  verifyAuth();
  const charge = await organizationService.createCharge(dto);
  await getOrganizationDetail({ id: dto.organizationId }).refresh();
  return charge;
});

export const getOrganizationMembers = query(v.string(), async (organizationId) => {
  verifyAuth();
  return await organizationService.listOrganizationMembers(organizationId);
});

export const addOrganizationMembers = command(addOrganizationMembersDto, async (dto) => {
  verifyAuth();
  const result = await organizationService.addOrganizationMembers(dto);
  await getOrganizationMembers(dto.organizationId).refresh();
  return result;
});

export const removeOrganizationMembers = command(removeOrganizationMembersDto, async (dto) => {
  verifyAuth();
  await organizationService.removeOrganizationMembers(dto.organizationId, dto.membershipIds);
  await getOrganizationMembers(dto.organizationId).refresh();
});
