import { command, form, query } from '$app/server';
import {
  submitPrintRequestDto,
  updatePrintRequestDto,
  updatePrintRequestStatusDto,
} from '$lib/remotes/dtos/print_request.dto';
import { verifyAuth } from '$lib/remotes/utils';
import { printFilesService } from '$lib/server/services/print_files.service';
import { printRequestService } from '$lib/server/services/print_request.service';
import * as v from 'valibot';

export const submitPrintRequestForm = form(submitPrintRequestDto, async (dto) => {
  await printRequestService.submitPrintRequest(dto);
});

export const getPrintRequests = query(async () => {
  verifyAuth();
  return await printRequestService.getPrintRequests();
});

export const getPrintRequestById = query(v.string(), async (id: string) => {
  verifyAuth();
  return await printRequestService.getPrintRequestById(id);
});

export const getPrintRequestQuote = query(v.string(), async (id: string) => {
  const request = await printRequestService.getPrintRequestById(id);
  if (request?.payment?.status !== 'quote') {
    throw new Error('Print request is not in quote status');
  }

  return request;
});

export const updatePrintRequest = command(
  v.intersect([updatePrintRequestDto, v.object({ id: v.string() })]),
  async (dto) => {
    verifyAuth();

    const { id, ...updates } = dto;
    return await printRequestService.updatePrintRequest(id, updates);
  },
);

export const updatePrintRequestStatus = command(
  v.intersect([updatePrintRequestStatusDto, v.object({ id: v.string() })]),
  async (dto) => {
    verifyAuth();

    const { id, ...updates } = dto;
    return await printRequestService.updatePrintRequestStatus(id, updates);
  },
);

export const getPrintRequestFiles = query(v.string(), async (printRequestId: string) => {
  verifyAuth();

  return await printFilesService.getByRequestId(printRequestId);
});
