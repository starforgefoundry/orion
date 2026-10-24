import { command, query } from '$app/server';
import { payPaymentDto } from '$lib/remotes/dtos/payment.dto';
import { PaymentDeclinedError } from '$lib/server/repositories/payment.repository';
import { PaymentNotPayableError, paymentService } from '$lib/server/services/payment.service';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';

const BAD_REQUEST = 400;

export const getPaymentCheckout = query(v.string(), async (id) => {
  return await paymentService.getCheckout(id);
});

export const payPayment = command(payPaymentDto, async (dto) => {
  try {
    const paid = await paymentService.pay(dto);
    await getPaymentCheckout(dto.id).refresh();
    return paid;
  } catch (cause) {
    if (cause instanceof PaymentDeclinedError || cause instanceof PaymentNotPayableError) {
      error(BAD_REQUEST, cause.message);
    }
    throw cause;
  }
});
