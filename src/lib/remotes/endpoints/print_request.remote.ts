import { command, form, query } from '$app/server';
import {
  addPrintRequestCommentDto,
  respondToQuoteDto,
  searchPrintRequestsDto,
  submitPrintRequestDto,
  updatePartQuantityDto,
  updatePrintRequestDto,
  updatePrintRequestDiscountDto,
  updatePrintRequestStatusDto,
} from '$lib/remotes/dtos/print_request.dto';
import { verifyAuth } from '$lib/remotes/utils';
import { printFilesService } from '$lib/server/services/print_files.service';
import { printPaymentService } from '$lib/server/services/print_payment.service';
import { printRequestService } from '$lib/server/services/print_request.service';
import { printRequestCommentService } from '$lib/server/services/print_request_comment.service';
import * as v from 'valibot';

export const submitPrintRequestForm = form(submitPrintRequestDto, async (dto) => {
  await printRequestService.submitPrintRequest(dto);
});

export const getPrintRequests = query(async () => {
  verifyAuth();
  return await printRequestService.getPrintRequests();
});

export const searchPrintRequests = query(searchPrintRequestsDto, async (dto) => {
  verifyAuth();
  return await printRequestService.searchPrintRequests(dto);
});

export const getPrintRequestById = query(v.string(), async (id: string) => {
  verifyAuth();
  return await printRequestService.getPrintRequestById(id);
});

export const getPrintRequestQuote = query(v.string(), async (id: string) => {
  return await printPaymentService.getPrintRequestQuote(id);
});

export const respondToPrintRequestQuote = command(respondToQuoteDto, async (dto) => {
  try {
    return await printPaymentService.respondToQuote(dto);
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
    await getPrintRequestById(id).refresh();

    return response;
  },
);

export const updatePrintRequestDiscount = command(
  v.intersect([updatePrintRequestDiscountDto, v.object({ id: v.string() })]),
  async (dto) => {
    verifyAuth();

    const { id, ...updates } = dto;
    const response = await printPaymentService.updatePrintRequestDiscount(id, updates);

    await getPrintRequests().refresh();
    await getPrintRequestById(id).refresh();

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

export const updatePartQuantity = command(
  v.intersect([v.object({ id: v.string() }), updatePartQuantityDto]),
  async (dto) => {
    verifyAuth();

    const { id, ...update } = dto;
    const response = await printRequestService.updatePartQuantity(update);

    await getPrintRequestById(id).refresh();
    await getPrintRequests().refresh();

    return response;
  },
);

export const getPrintRequestFiles = query(v.string(), async (printRequestId: string) => {
  verifyAuth();

  return await printFilesService.getByRequestId(printRequestId);
});

export const getPrintRequestComments = query(v.string(), async (printRequestId: string) => {
  verifyAuth();

  return await printRequestCommentService.getForRequest(printRequestId);
});

export const addPrintRequestCommentForm = form(addPrintRequestCommentDto, async (dto) => {
  const staff = verifyAuth();

  const comment = await printRequestCommentService.addComment(dto, staff.email);
  await getPrintRequestComments(dto.printRequestId).refresh();

  return comment;
});

export const sendPickupNotification = command(v.string(), async (printRequestId: string) => {
  verifyAuth();

  return await printRequestService.sendPickupNotification(printRequestId);
});
