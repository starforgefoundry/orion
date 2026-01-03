import { luxonDatetime } from '$lib/remotes/dtos/utils';
import * as v from 'valibot';

export const createPaymentDto = v.object({
  requestId: v.string(),
  materialCost: v.pipe(v.number(), v.minValue(0)),
  buildPlates: v.pipe(v.number(), v.minValue(1)),
});

export type CreatePaymentDto = v.InferInput<typeof createPaymentDto>;

export const printPaymentDto = v.object({
  id: v.string(),
  issuedDate: luxonDatetime,
  paymentDate: v.nullable(luxonDatetime),
  status: v.union([
    v.literal('quote'),
    v.literal('pending'),
    v.literal('paid'),
    v.literal('canceled'),
  ]),
  total: v.number(),
  squareInvoiceId: v.string(),
  squareOrderId: v.string(),
});

export type PrintPaymentDto = v.InferInput<typeof printPaymentDto>;
