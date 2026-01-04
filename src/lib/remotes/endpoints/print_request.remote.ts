import { command, form, query } from '$app/server';
import {
  respondToQuoteDto,
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
  return await printRequestService.getPrintRequestQuote(id);
});

export const respondToPrintRequestQuote = command(respondToQuoteDto, async (dto) => {
  try {
    return await printRequestService.respondToQuote(dto);
  } catch (error) {
    console.error('Error responding to print request quote:', error);
    throw error;
  }
});

export const updatePrintRequest = command(
  v.intersect([updatePrintRequestDto, v.object({ id: v.string() })]),
  async (dto) => {
    verifyAuth();

    const { id, ...updates } = dto;
    const response = await printRequestService.updatePrintRequest(id, updates);

    await getPrintRequests().refresh();

    return response;
  },
);

export const updatePrintRequestStatus = command(
  v.intersect([updatePrintRequestStatusDto, v.object({ id: v.string() })]),
  async (dto) => {
    verifyAuth();

    const { id, ...updates } = dto;
    const response = await printRequestService.updatePrintRequestStatus(id, updates);
    await getPrintRequests().refresh();

    return response;
  },
);

export const getPrintRequestFiles = query(v.string(), async (printRequestId: string) => {
  verifyAuth();

  return await printFilesService.getByRequestId(printRequestId);
});
