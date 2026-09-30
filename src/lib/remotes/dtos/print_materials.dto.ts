import * as v from 'valibot';

export const TAG_ID_LENGTH = 8;

/** Printed on the empty slot card. Scanning it in a slot's position clears that AMS slot. */
export const EMPTY_SLOT_TAG_ID = 'EMPTY---';

export const printMaterialDto = v.object({
  id: v.string(),
  name: v.string(),
  available: v.boolean(),
  archived: v.boolean(),
});

export type PrintMaterialDto = v.InferInput<typeof printMaterialDto>;

const colorHex = v.pipe(v.string(), v.regex(/^#[0-9A-Fa-f]{6}$/, 'Enter a color like #RRGGBB'));

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

export const setMaterialSetupDto = v.object({
  id: v.string(),
  tagId: v.nullable(
    v.pipe(
      v.string(),
      v.trim(),
      v.toUpperCase(),
      v.length(TAG_ID_LENGTH, `Tag IDs are exactly ${TAG_ID_LENGTH} characters`),
    ),
  ),
  filament: v.nullable(
    v.object({
      vendor: v.string(),
      materialType: v.string(),
      colorName: v.string(),
      colorHex,
    }),
  ),
});
export type SetMaterialSetupDto = v.InferOutput<typeof setMaterialSetupDto>;

export const filamentColorDto = v.object({
  name: v.string(),
  hex: v.string(),
});

export const filamentMaterialDto = v.object({
  material: v.string(),
  filamentId: v.string(),
  colors: v.array(filamentColorDto),
});

export const filamentVendorDto = v.object({
  vendor: v.string(),
  materials: v.array(filamentMaterialDto),
});
export type FilamentVendorDto = v.InferOutput<typeof filamentVendorDto>;

export const updateAMSDto = v.object({
  printer_id: v.string(),
  filaments: v.array(v.string()),
});
