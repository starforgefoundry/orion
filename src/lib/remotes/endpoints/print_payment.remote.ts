import { form, query } from '$app/server';
import { createPaymentDto } from '$lib/remotes/dtos/print_payment.dto';
import { getPrintRequestById, getPrintRequests } from '$lib/remotes/endpoints/print_request.remote';
import { verifyAuth } from '$lib/remotes/utils';
import { printPaymentService } from '$lib/server/services/print_payment.service';
import * as v from 'valibot';

export const getPayment = query(v.string(), async (id) => {
  verifyAuth();
  return await printPaymentService.getById(id);
});

export const getPricingInfo = query(
  v.object({
    customerEmail: v.pipe(v.string(), v.email()),
    billingCode: v.optional(v.string()),
  }),
  async (dto) => {
    verifyAuth();
    return await printPaymentService.getPricingInfo(dto.customerEmail, dto.billingCode);
  },
);

export const upsertPaymentForm = form(createPaymentDto, async (dto) => {
  verifyAuth();

  const response = await printPaymentService.upsertPayment(dto);

  await getPayment(response.id).refresh();
  await getPrintRequests().refresh();
  await getPrintRequestById(dto.requestId).refresh();

  return response;
});
