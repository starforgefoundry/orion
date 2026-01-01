import * as v from 'valibot';

export const printRequestCustomerDto = v.object({
  name: v.string(),
  email: v.pipe(v.string(), v.email()),
});

export type PrintRequestCustomerDto = v.InferInput<typeof printRequestCustomerDto>;
