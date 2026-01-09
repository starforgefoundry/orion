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

export const createInventoryItemDto = v.object({
  name: v.string(),
  vendor: v.string(),
  url: v.string(),
  imageUrl: v.optional(v.string(), ''),
  description: v.string(),
});

export type CreateInventoryItemDto = v.InferInput<typeof createInventoryItemDto>;

export const updateInventoryItemDto = v.object({
  id: v.string(),
  name: v.optional(v.string()),
  vendor: v.optional(v.string()),
  url: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
  description: v.optional(v.string()),
});

export type UpdateInventoryItemDto = v.InferInput<typeof updateInventoryItemDto>;

export const purchaseListItemDto = v.object({
  id: v.string(),
  inventoryItemId: v.string(),
  addedDate: v.string(),
  inventoryItem: v.optional(inventoryItemDto),
});

export type PurchaseListItemDto = v.InferInput<typeof purchaseListItemDto>;
