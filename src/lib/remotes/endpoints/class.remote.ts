import { command, form, query } from '$app/server';
import {
  bookClassDto,
  cancelBookingDto,
  cancelBookingStaffDto,
  cancelInstanceDto,
  createInstanceDto,
  generateInstancesDto,
  manualBookClassDto,
  rescheduleBookingDto,
  upsertCatalogDto,
} from '$lib/remotes/dtos/class.dto';
import { exposeUserErrors, verifyAuth } from '$lib/server/remote-utils';
import { classService } from '$lib/server/services/class.service';
import * as v from 'valibot';

// ── Staff: Catalog ──

export const getCatalogs = query(
  exposeUserErrors(async () => {
    verifyAuth();
    return await classService.getAllCatalogs();
  }),
);

export const getCatalogById = query(
  v.string(),
  exposeUserErrors(async (id: string) => {
    return await classService.getCatalogById(id);
  }),
);

export const upsertCatalogForm = form(
  upsertCatalogDto,
  exposeUserErrors(async (dto) => {
    verifyAuth();
    const result = await classService.upsertCatalog(dto);
    await getCatalogs().refresh();
    return result;
  }),
);

// ── Staff: Instance ──

export const getAllInstances = query(
  exposeUserErrors(async () => {
    verifyAuth();
    return await classService.getAllInstances();
  }),
);

export const getInstanceDetail = query(
  v.string(),
  exposeUserErrors(async (instanceId: string) => {
    verifyAuth();
    return await classService.getInstanceDetail(instanceId);
  }),
);

export const generateInstances = command(
  generateInstancesDto,
  exposeUserErrors(async (dto) => {
    verifyAuth();
    const result = await classService.generateInstances(dto);
    await getAllInstances().refresh();
    return result;
  }),
);

export const createInstance = command(
  createInstanceDto,
  exposeUserErrors(async (dto) => {
    verifyAuth();
    const result = await classService.createInstance(dto);
    await getAllInstances().refresh();
    return result;
  }),
);

export const cancelInstance = command(
  cancelInstanceDto,
  exposeUserErrors(async (dto) => {
    verifyAuth();
    const result = await classService.cancelInstance(dto);
    await getAllInstances().refresh();
    await getInstanceDetail(dto.instanceId).refresh();
    return result;
  }),
);

export const cancelBookingStaff = command(
  cancelBookingStaffDto,
  exposeUserErrors(async (dto) => {
    verifyAuth();
    const result = await classService.cancelBookingStaff(dto);
    await getAllInstances().refresh();
    await getInstanceDetail(result.instanceId).refresh();
    return result;
  }),
);

export const rescheduleBookingStaff = command(
  rescheduleBookingDto,
  exposeUserErrors(async (dto) => {
    verifyAuth();
    const result = await classService.rescheduleBooking(dto);
    await getAllInstances().refresh();
    await getInstanceDetail(result.previousInstanceId).refresh();
    await getInstanceDetail(dto.targetInstanceId).refresh();
    return result;
  }),
);

export const manualBookClass = command(
  manualBookClassDto,
  exposeUserErrors(async (dto) => {
    verifyAuth();
    const result = await classService.manualBookClass(dto);
    await getAllInstances().refresh();
    return result;
  }),
);

export const getStaffUsers = query(
  exposeUserErrors(async () => {
    verifyAuth();
    return await classService.getStaffUsers();
  }),
);

export const getMyCalendarLink = query(
  exposeUserErrors(async () => {
    const authUser = verifyAuth();
    return await classService.getCalendarLinkFor(authUser.email);
  }),
);

// ── Public ──

export const getActiveClasses = query(
  exposeUserErrors(async () => {
    return await classService.getActiveCatalogsWithInstances();
  }),
);

export const getClassInstances = query(
  v.string(),
  exposeUserErrors(async (classId: string) => {
    return await classService.getInstancesForCatalog(classId);
  }),
);

export const bookClass = command(
  bookClassDto,
  exposeUserErrors(async (dto) => {
    return await classService.bookClass(dto);
  }),
);

export const getBookingByToken = query(
  v.string(),
  exposeUserErrors(async (token: string) => {
    return await classService.getBookingByToken(token);
  }),
);

export const cancelBooking = command(
  cancelBookingDto,
  exposeUserErrors(async (dto) => {
    const result = await classService.cancelBooking(dto);
    await getBookingByToken(dto.bookingToken).refresh();
    return result;
  }),
);
