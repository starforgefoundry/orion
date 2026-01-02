import * as v from 'valibot';

export const printMaterialDto = v.object({
  id: v.string(),
  name: v.string(),
  available: v.boolean(),
  archived: v.boolean(),
});

export type PrintMaterialDto = v.InferInput<typeof printMaterialDto>;

export const createPrintMaterialDto = v.object({
  name: v.string(),
  available: v.optional(v.boolean(), true),
  archived: v.optional(v.boolean(), false),
});
export type CreatePrintMaterialDto = v.InferInput<typeof createPrintMaterialDto>;

export const updatePrintMaterialDto = v.object({
  id: v.string(),
  name: v.optional(v.string()),
  available: v.optional(v.boolean()),
  archived: v.optional(v.boolean()),
});
export type UpdatePrintMaterialDto = v.InferInput<typeof updatePrintMaterialDto>;
