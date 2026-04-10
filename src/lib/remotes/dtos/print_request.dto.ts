import {
  schema,
  type Payment,
  type PrintMaterial,
  type PrintRequestFile,
} from '$lib/server/db/schema';
import * as v from 'valibot';

export const printRequestFileDto = v.object({
  file: v.file(),
  filename: v.string(),
  quantity: v.number(),
});

export type PrintRequestFileDto = v.InferInput<typeof printRequestFileDto>;

export const submitPrintRequestDto = v.object({
  customer: v.object({
    name: v.string(),
    email: v.pipe(v.string(), v.email()),
  }),
  projectName: v.string(),
  specialRequests: v.optional(v.string(), ''),
  isQuote: v.optional(v.boolean(), false),
  material: v.string(),
  billingCode: v.optional(v.string(), ''),
  files: v.array(printRequestFileDto),
});

export type SubmitPrintRequestDto = v.InferInput<typeof submitPrintRequestDto>;

export const updatePrintRequestDto = v.object({
  customerName: v.optional(v.string()),
  email: v.optional(v.pipe(v.string(), v.email())),
  projectName: v.optional(v.string()),
  specialRequests: v.optional(v.string()),
  isQuote: v.optional(v.boolean()),
  material: v.optional(v.string()),
  billingCode: v.optional(v.string()),
  buildplateCount: v.optional(v.number()),
  materialCost: v.optional(v.number()),
});

export type UpdatePrintRequestDto = v.InferInput<typeof updatePrintRequestDto>;

export const updatePrintRequestDiscountDto = v.object({
  billingCode: v.optional(v.string(), ''),
});

export type UpdatePrintRequestDiscountDto = v.InferInput<typeof updatePrintRequestDiscountDto>;

export const updatePrintRequestStatusDto = v.object({
  status: v.union([
    v.literal('in_queue'),
    v.literal('printing'),
    v.literal('done'),
    v.literal('picked_up'),
    v.literal('canceled'),
  ]),
});

export type UpdatePrintRequestStatusDto = v.InferInput<typeof updatePrintRequestStatusDto>;

export const respondToQuoteDto = v.object({
  id: v.string(),
  approve: v.boolean(),
});

export type RespondToQuoteDto = v.InferInput<typeof respondToQuoteDto>;

export const updatePartQuantityDto = v.object({
  partId: v.string(),
  quantity: v.number(),
});

export type UpdatePartQuantityDto = v.InferInput<typeof updatePartQuantityDto>;

export const searchPrintRequestsDto = v.object({
  query: v.string(),
  page: v.optional(v.number(), 1),
  pageSize: v.optional(v.number(), 25),
});

export type SearchPrintRequestsDto = v.InferInput<typeof searchPrintRequestsDto>;

export type PrintRequestDto = Omit<typeof schema.printRequest.$inferSelect, 'material'> & {
  payment: Payment | null;
  material: PrintMaterial;
  files: PrintRequestFile[];
};

export type PrintRequestStatus = PrintRequestDto['status'];
