import * as v from 'valibot';

export const inventoryItemDto = v.object({
  id: v.string(),
  name: v.string(),
  vendor: v.string(),
  url: v.string(),
  imageUrl: v.optional(v.nullable(v.string())),
  description: v.string(),
});

export type InventoryItemDto = v.InferInput<typeof inventoryItemDto>;

export const upsertInventoryItemDto = v.object({
  id: v.optional(v.string()),
  name: v.string(),
  vendor: v.string(),
  url: v.string(),
  imageUrl: v.optional(v.string(), ''),
  description: v.string(),
});

export type UpsertInventoryItemDto = v.InferInput<typeof upsertInventoryItemDto>;

export const purchaseListItemDto = v.object({
  id: v.string(),
  inventoryItemId: v.string(),
  addedDate: v.string(),
  inventoryItem: v.optional(inventoryItemDto),
});

export type PurchaseListItemDto = v.InferInput<typeof purchaseListItemDto>;
