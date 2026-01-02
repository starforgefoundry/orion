import { query } from '$app/server';
import { verifyAuth } from '$lib/remotes/utils';
import { printPaymentService } from '$lib/server/services/print_payment.service';
import * as v from 'valibot';

export const getPayment = query(v.string(), async (id) => {
  verifyAuth();
  return await printPaymentService.getById(id);
});

export const getPricingInfo = query(v.string(), async (requestId) => {
  verifyAuth();
  return await printPaymentService.getPricingInfo(requestId);
});
