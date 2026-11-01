import { command, query } from '$app/server';
import { payPaymentDto } from '$lib/remotes/dtos/payment.dto';
import { exposeUserErrors } from '$lib/remotes/utils';
import { paymentService } from '$lib/server/services/payment.service';
import * as v from 'valibot';

export const getPaymentCheckout = query(
  v.string(),
  exposeUserErrors(async (id) => {
    return await paymentService.getCheckout(id);
  }),
);

export const payPayment = command(
  payPaymentDto,
  exposeUserErrors(async (dto) => {
    const paid = await paymentService.pay(dto);
    await getPaymentCheckout(dto.id).refresh();
    return paid;
  }),
);

export const getCheckoutConfig = query(
  exposeUserErrors(async () => {
    return await paymentService.getCheckoutConfig();
  }),
);
