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
} from '$lib/remotes/dtos/print-request.dto';
import { payPaymentDto } from '$lib/remotes/dtos/payment.dto';
import { exposeUserErrors, verifyAuth } from '$lib/server/remote-utils';
import { printFilesService } from '$lib/server/services/print-files.service';
import { printPaymentService } from '$lib/server/services/print-payment.service';
import { printRequestService } from '$lib/server/services/print-request.service';
import { printRequestCommentService } from '$lib/server/services/print-request-comment.service';
import * as v from 'valibot';

export const submitPrintRequestForm = form(
  submitPrintRequestDto,
  exposeUserErrors(async (dto) => {
    await printRequestService.submitPrintRequest(dto);
  }),
);

export const getPrintRequests = query(
  exposeUserErrors(async () => {
    verifyAuth();
    return await printRequestService.getPrintRequests();
  }),
);

export const searchPrintRequests = query(
  searchPrintRequestsDto,
  exposeUserErrors(async (dto) => {
    verifyAuth();
    return await printRequestService.searchPrintRequests(dto);
  }),
);

export const getPrintRequestById = query(
  v.string(),
  exposeUserErrors(async (id: string) => {
    verifyAuth();
    return await printRequestService.getPrintRequestById(id);
  }),
);

export const getPrintRequestStatus = query(
  v.string(),
  exposeUserErrors(async (id: string) => {
    return await printRequestService.getStatus(id);
  }),
);

export const respondToPrintRequestQuote = command(
  respondToQuoteDto,
  exposeUserErrors(async (dto) => {
    const response = await printPaymentService.respondToQuote(dto);
    await getPrintRequestStatus(dto.id).refresh();
    return response;
  }),
);

export const payPrintRequest = command(
  payPaymentDto,
  exposeUserErrors(async (dto) => {
    const response = await printPaymentService.payPrintRequest(dto);
    await getPrintRequestStatus(dto.id).refresh();
    return response;
  }),
);

export const updatePrintRequest = command(
  v.intersect([updatePrintRequestDto, v.object({ id: v.string() })]),
  exposeUserErrors(async (dto) => {
    verifyAuth();

    const { id, ...updates } = dto;
    const response = await printRequestService.updatePrintRequest(id, updates);

    await getPrintRequests().refresh();
    await getPrintRequestById(id).refresh();

    return response;
  }),
);

export const updatePrintRequestDiscount = command(
  v.intersect([updatePrintRequestDiscountDto, v.object({ id: v.string() })]),
  exposeUserErrors(async (dto) => {
    verifyAuth();

    const { id, ...updates } = dto;
    const response = await printPaymentService.updatePrintRequestDiscount(id, updates);

    await getPrintRequests().refresh();
    await getPrintRequestById(id).refresh();

    return response;
  }),
);

export const updatePrintRequestStatus = command(
  v.intersect([updatePrintRequestStatusDto, v.object({ id: v.string() })]),
  exposeUserErrors(async (dto) => {
    verifyAuth();

    const { id, ...updates } = dto;
    const response = await printRequestService.updatePrintRequestStatus(id, updates);
    await getPrintRequests().refresh();

    return response;
  }),
);

export const updatePartQuantity = command(
  v.intersect([v.object({ id: v.string() }), updatePartQuantityDto]),
  exposeUserErrors(async (dto) => {
    verifyAuth();

    const { id, ...update } = dto;
    const response = await printRequestService.updatePartQuantity(update);

    await getPrintRequestById(id).refresh();
    await getPrintRequests().refresh();

    return response;
  }),
);

export const getPrintRequestDownloadUrl = query(
  v.string(),
  exposeUserErrors(async (printRequestId: string) => {
    verifyAuth();

    return printFilesService.getDownloadUrl(printRequestId);
  }),
);

export const getPrintRequestComments = query(
  v.string(),
  exposeUserErrors(async (printRequestId: string) => {
    verifyAuth();

    return await printRequestCommentService.getForRequest(printRequestId);
  }),
);

export const addPrintRequestCommentForm = form(
  addPrintRequestCommentDto,
  exposeUserErrors(async (dto) => {
    const staff = verifyAuth();

    const comment = await printRequestCommentService.addComment(dto, staff.email);
    await getPrintRequestComments(dto.printRequestId).refresh();

    return comment;
  }),
);

export const sendPickupNotification = command(
  v.string(),
  exposeUserErrors(async (printRequestId: string) => {
    verifyAuth();

    return await printRequestService.sendPickupNotification(printRequestId);
  }),
);
