import { command, form, query } from '$app/server';
import {
  quoteServiceRequestDto,
  submitServiceRequestDto,
  updateServiceRequestStatusDto,
  upsertServiceDto,
} from '$lib/remotes/dtos/service.dto';
import { exposeUserErrors, verifyAuth } from '$lib/server/remote-utils';
import { serviceService } from '$lib/server/services/service.service';
import * as v from 'valibot';

// ── Staff ──

export const getServices = query(
  exposeUserErrors(async () => {
    verifyAuth();
    return await serviceService.getAllServices();
  }),
);

export const upsertService = command(
  upsertServiceDto,
  exposeUserErrors(async (dto) => {
    verifyAuth();
    const result = await serviceService.upsertService(dto);
    await getServices().refresh();
    return result;
  }),
);

export const getServiceRequests = query(
  exposeUserErrors(async () => {
    verifyAuth();
    return await serviceService.getRequests();
  }),
);

export const updateServiceRequestStatus = command(
  updateServiceRequestStatusDto,
  exposeUserErrors(async (dto) => {
    verifyAuth();
    const result = await serviceService.updateRequestStatus(dto);
    await getServiceRequests().refresh();
    return result;
  }),
);

export const quoteServiceRequest = command(
  quoteServiceRequestDto,
  exposeUserErrors(async (dto) => {
    verifyAuth();
    const result = await serviceService.quoteRequest(dto);
    await getServiceRequests().refresh();
    return result;
  }),
);

// ── Public ──

export const getEnabledServices = query(
  exposeUserErrors(async () => {
    return await serviceService.getEnabledServices();
  }),
);

export const getEnabledService = query(
  v.string(),
  exposeUserErrors(async (id: string) => {
    return await serviceService.getEnabledService(id);
  }),
);

export const submitServiceRequestForm = form(
  submitServiceRequestDto,
  exposeUserErrors(async (dto) => {
    return await serviceService.submitRequest(dto);
  }),
);
