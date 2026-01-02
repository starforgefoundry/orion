import type { PrintMaterialDto } from '$lib/remotes/dtos/print_materials.dto';
import { schema } from '$lib/server/db/schema';
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
  status: v.optional(
    v.union([
      v.literal('in_queue'),
      v.literal('printing'),
      v.literal('done'),
      v.literal('picked_up'),
      v.literal('cancelled'),
    ]),
  ),
  projectName: v.optional(v.string()),
  specialRequests: v.optional(v.string()),
  isQuote: v.optional(v.boolean()),
  material: v.optional(v.string()),
  billingCode: v.optional(v.string()),
});

export type UpdatePrintRequestDto = v.InferInput<typeof updatePrintRequestDto>;

export type PrintRequestDto = Omit<typeof schema.printRequest.$inferSelect, 'material'> & {
  material: PrintMaterialDto;
};

export type PrintRequestStatus = PrintRequestDto['status'];
