import * as v from 'valibot';

export const createPaymentDto = v.object({
  requestId: v.string(),
  materialCost: v.pipe(v.number(), v.minValue(0)),
  buildPlates: v.pipe(v.number(), v.minValue(1)),
});

export type CreatePaymentDto = v.InferInput<typeof createPaymentDto>;
