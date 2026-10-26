import * as v from 'valibot';

export const payPaymentDto = v.object({
  id: v.string(),
  sourceId: v.pipe(v.string(), v.minLength(1)),
});

export type PayPaymentDto = v.InferInput<typeof payPaymentDto>;
