import { command, form, query } from '$app/server';
import {
  addOrganizationMembersDto,
  chargeOrganizationBalanceDto,
  createOrganizationDto,
  removeOrganizationMembersDto,
  updateOrganizationDto,
} from '$lib/remotes/dtos/organization.dto';
import { createOrgChargeDto } from '$lib/remotes/dtos/organization-charges.dto';
import { staffOnly } from '$lib/server/remote-utils';
import { organizationService } from '$lib/server/services/organization.service';
import * as v from 'valibot';

export const getOrganizations = query(staffOnly(() => organizationService.getOrganizations()));

export const getOrganizationDetail = query(
  v.object({ id: v.string() }),
  staffOnly((dto) => organizationService.getOrganizationDetail(dto.id)),
);

export const createOrganizationForm = form(
  createOrganizationDto,
  staffOnly(async (data) => {
    const organization = await organizationService.createOrganization(data);
    await getOrganizations().refresh();
    return organization;
  }),
);

export const updateOrganization = command(
  updateOrganizationDto,
  staffOnly(async (dto) => {
    const { id, ...updates } = dto;
    const organization = await organizationService.updateOrganization(id, updates);
    await getOrganizations().refresh();
    return organization;
  }),
);

export const archiveOrganization = command(
  v.object({ id: v.string() }),
  staffOnly(async (dto) => {
    await organizationService.archiveOrganization(dto.id);
    await getOrganizations().refresh();
  }),
);

export const chargeOrganizationBalance = command(
  chargeOrganizationBalanceDto,
  staffOnly(async (dto) => {
    const payment = await organizationService.chargeBalance(dto);
    await getOrganizationDetail({ id: dto.organizationId }).refresh();
    return payment;
  }),
);

export const createOrganizationChargeForm = form(
  createOrgChargeDto,
  staffOnly(async (dto) => {
    const charge = await organizationService.createCharge(dto);
    await getOrganizationDetail({ id: dto.organizationId }).refresh();
    return charge;
  }),
);

export const getOrganizationMembers = query(
  v.string(),
  staffOnly((organizationId) => organizationService.listOrganizationMembers(organizationId)),
);

export const addOrganizationMembers = command(
  addOrganizationMembersDto,
  staffOnly(async (dto) => {
    const result = await organizationService.addOrganizationMembers(dto);
    await getOrganizationMembers(dto.organizationId).refresh();
    return result;
  }),
);

export const removeOrganizationMembers = command(
  removeOrganizationMembersDto,
  staffOnly(async (dto) => {
    await organizationService.removeOrganizationMembers(dto.organizationId, dto.membershipIds);
    await getOrganizationMembers(dto.organizationId).refresh();
  }),
);
