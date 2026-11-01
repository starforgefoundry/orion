import { form, query } from '$app/server';
import { createPaymentDto } from '$lib/remotes/dtos/print-payment.dto';
import { getPrintRequestById, getPrintRequests } from '$lib/remotes/endpoints/print-request.remote';
import { exposeUserErrors, verifyAuth } from '$lib/server/remote-utils';
import { printPaymentService } from '$lib/server/services/print-payment.service';
import * as v from 'valibot';

export const getPricingInfo = query(
  v.object({
    customerEmail: v.pipe(v.string(), v.email()),
    billingCode: v.optional(v.string()),
  }),
  exposeUserErrors(async (dto) => {
    verifyAuth();
    return await printPaymentService.getPricingInfo(dto.customerEmail, dto.billingCode);
  }),
);

export const upsertPaymentForm = form(
  createPaymentDto,
  exposeUserErrors(async (dto) => {
    verifyAuth();

    const response = await printPaymentService.upsertPayment(dto);

    await getPrintRequests().refresh();
    await getPrintRequestById(dto.requestId).refresh();

    return response;
  }),
);
