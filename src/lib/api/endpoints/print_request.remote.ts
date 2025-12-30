import { command, form, query } from '$app/server';
import { submitPrintRequestDto, updatePrintRequestDto } from '$lib/api/dtos/print_request.dto';
import { verifyAuth } from '$lib/api/utils';
import { printCustomerRepository } from '$lib/server/repositories/print_customer.repostiory';
import { printFilesRepository } from '$lib/server/repositories/print_files.repository';
import { printRequestRepository } from '$lib/server/repositories/print_request.repository';
import * as v from 'valibot';

export const submitPrintRequestForm = form(submitPrintRequestDto, async (dto) => {
  await printCustomerRepository.upsert(dto.customer);
  const printRequest = await printRequestRepository.submit(dto);

  return {
    status: 'success',
    printRequestId: printRequest.id,
  };
});

export const getPrintRequests = query(async () => {
  verifyAuth();
  return await printRequestRepository.getAll();
});

export const updatePrintRequest = command(
  v.intersect([updatePrintRequestDto, v.object({ id: v.string() })]),
  async (dto) => {
    verifyAuth();

    const { id, ...updates } = dto;
    const updated = await printRequestRepository.update(id, updates);

    await getPrintRequests().refresh();

    return updated;
  },
);

export const getPrintRequestFiles = query(v.string(), async (printRequestId: string) => {
  verifyAuth();

  return await printFilesRepository.getByPrintRequestId(printRequestId);
});
