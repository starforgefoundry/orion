import { command, form, query } from '$app/server';
import {
  priceServiceRequestDto,
  submitServiceRequestDto,
  updateServiceRequestStatusDto,
  upsertServiceDto,
} from '$lib/remotes/dtos/service.dto';
import { exposeUserErrors, staffOnly } from '$lib/server/remote-utils';
import { serviceService } from '$lib/server/services/service.service';
import * as v from 'valibot';

// ── Staff ──

export const getServices = query(staffOnly(() => serviceService.getAllServices()));

export const upsertService = command(
  upsertServiceDto,
  staffOnly(async (dto) => {
    const result = await serviceService.upsertService(dto);
    await getServices().refresh();
    return result;
  }),
);

export const getServiceRequests = query(staffOnly(() => serviceService.getRequests()));

export const updateServiceRequestStatus = command(
  updateServiceRequestStatusDto,
  staffOnly(async (dto) => {
    const result = await serviceService.updateRequestStatus(dto);
    await getServiceRequests().refresh();
    return result;
  }),
);

export const priceServiceRequest = command(
  priceServiceRequestDto,
  staffOnly(async (dto) => {
    const result = await serviceService.priceRequest(dto);
    await getServiceRequests().refresh();
    return result;
  }),
);

export const sendServiceReadyEmail = command(
  v.string(),
  staffOnly(async (id: string) => {
    await serviceService.sendReadyEmail(id);
  }),
);

export const sendServicePaymentReminder = command(
  v.string(),
  staffOnly(async (id: string) => {
    await serviceService.sendPaymentReminder(id);
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
