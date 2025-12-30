import * as v from 'valibot';

export const printRequestCustomerDto = v.object({
  name: v.string(),
  email: v.pipe(v.string(), v.email()),
  isMember: v.boolean(),
});

export type PrintRequestCustomerDto = v.InferInput<typeof printRequestCustomerDto>;
