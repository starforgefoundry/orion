import { command, form, query } from '$app/server';
import { env } from '$env/dynamic/private';
import { redirect } from '@sveltejs/kit';
import {
  bookClassDto,
  cancelBookingDto,
  cancelBookingStaffDto,
  cancelInstanceDto,
  createInstanceDto,
  generateInstancesDto,
  manualBookClassDto,
  updateInstanceDto,
  upsertCatalogDto,
} from '$lib/remotes/dtos/class.dto';
import { verifyAuth } from '$lib/remotes/utils';
import { classService } from '$lib/server/services/class.service';
import { SettingsRepository } from '$lib/server/repositories/settings.repository';
import * as v from 'valibot';

// ── Staff: Catalog ──

export const getCatalogs = query(async () => {
  verifyAuth();
  return await classService.getAllCatalogs();
});

export const getCatalogById = query(v.string(), async (id: string) => {
  return await classService.getCatalogById(id);
});

export const upsertCatalogForm = form(upsertCatalogDto, async (dto) => {
  verifyAuth();
  const { photo, id, ...fields } = dto;

  let result;
  if (id) {
    result = await classService.updateCatalog({ id, ...fields });
  } else {
    result = await classService.createCatalog(fields);
  }

  if (photo) {
    await classService.uploadClassPhoto(result.id, photo);
  }

  await getCatalogs().refresh();
  return result;
});

// ── Staff: Instance ──

export const getAllInstances = query(async () => {
  verifyAuth();
  return await classService.getAllInstances();
});

export const getInstanceDetail = query(v.string(), async (instanceId: string) => {
  verifyAuth();
  return await classService.getInstanceDetail(instanceId);
});

export const generateInstances = command(generateInstancesDto, async (dto) => {
  verifyAuth();
  const result = await classService.generateInstances(dto);
  await getAllInstances().refresh();
  return result;
});

export const createInstance = command(createInstanceDto, async (dto) => {
  verifyAuth();
  const result = await classService.createInstance(dto);
  await getAllInstances().refresh();
  return result;
});

export const updateInstance = command(updateInstanceDto, async (dto) => {
  verifyAuth();
  const result = await classService.updateInstance(dto);
  await getAllInstances().refresh();
  await getInstanceDetail(dto.id).refresh();
  return result;
});

export const cancelInstance = command(cancelInstanceDto, async (dto) => {
  verifyAuth();
  const result = await classService.cancelInstance(dto);
  await getAllInstances().refresh();
  await getInstanceDetail(dto.instanceId).refresh();
  return result;
});

export const cancelBookingStaff = command(cancelBookingStaffDto, async (dto) => {
  verifyAuth();
  const result = await classService.cancelBookingStaff(dto);
  await getAllInstances().refresh();
  return result;
});

export const manualBookClass = command(manualBookClassDto, async (dto) => {
  verifyAuth();
  const result = await classService.manualBookClass(dto);
  await getAllInstances().refresh();
  return result;
});

export const getStaffUsers = query(async () => {
  verifyAuth();
  return await classService.getStaffUsers();
});

export const getMyCalendarLink = query(async () => {
  const authUser = verifyAuth();
  const users = await classService.getStaffUsers();
  const teacher = users.find((u) => u.email === authUser.email);
  if (!teacher) return null;
  return await classService.getTeacherCalendarLink(teacher);
});

// ── Public ──

export const getActiveClasses = query(async () => {
  return await classService.getActiveCatalogsWithInstances();
});

export const getClassInstances = query(v.string(), async (classId: string) => {
  return await classService.getInstancesForCatalog(classId);
});

export const bookClassForm = form(bookClassDto, async (dto) => {
  const result = await classService.bookClass(dto);
  redirect(303, `/classes/booking/${result.bookingToken}`);
});

export const bookClass = command(bookClassDto, async (dto) => {
  return await classService.bookClass(dto);
});

export const getBookingByToken = query(v.string(), async (token: string) => {
  return await classService.getBookingByToken(token);
});

export const cancelBooking = command(cancelBookingDto, async (dto) => {
  return await classService.cancelBooking(dto);
});

export const getSquareConfig = query(async () => {
  const settingsRepository = new SettingsRepository();
  const squareSettings = await settingsRepository.getSetting('printRequestSquare');
  return {
    applicationId: env.SQUARE_APPLICATION_ID ?? '',
    locationId: squareSettings.locationId,
  };
});
