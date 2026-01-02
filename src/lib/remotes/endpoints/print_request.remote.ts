import { command, form, query } from '$app/server';
import { submitPrintRequestDto, updatePrintRequestDto } from '$lib/remotes/dtos/print_request.dto';
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

export const updatePrintRequest = command(
  v.intersect([updatePrintRequestDto, v.object({ id: v.string() })]),
  async (dto) => {
    verifyAuth();

    const { id, ...updates } = dto;
    return await printRequestService.updatePrintRequest(id, updates);
  },
);

export const getPrintRequestFiles = query(v.string(), async (printRequestId: string) => {
  verifyAuth();

  return await printFilesService.getByRequestId(printRequestId);
});
