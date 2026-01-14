import { command, form, query } from '$app/server';
import { upsertInventoryItemDto } from '$lib/remotes/dtos/inventory.dto';
import { verifyAuth } from '$lib/remotes/utils';
import { inventoryService } from '$lib/server/services/inventory.service';
import * as v from 'valibot';

export const getInventoryItems = query(async () => {
  verifyAuth();
  return await inventoryService.getItems();
});

export const getInventoryItemById = query(v.object({ id: v.string() }), async (dto) => {
  verifyAuth();
  return await inventoryService.getItemById(dto.id);
});

export const upsertInventoryItem = form(upsertInventoryItemDto, async (data) => {
  verifyAuth();
  const item = await inventoryService.upsertItem(data);
  await getInventoryItems().refresh();
  return item;
});

export const deleteInventoryItem = command(v.object({ id: v.string() }), async (dto) => {
  verifyAuth();
  await inventoryService.deleteItem(dto.id);
  await getInventoryItems().refresh();
  await getPurchaseList().refresh();
});

export const getPurchaseList = query(async () => {
  verifyAuth();
  return await inventoryService.getPurchaseList();
});

export const addToPurchaseList = command(v.object({ inventoryItemId: v.string() }), async (dto) => {
  // No auth required for this - QR code scanning
  const item = await inventoryService.addToPurchaseList(dto.inventoryItemId);
  return item;
});

export const removeFromPurchaseList = command(
  v.object({ inventoryItemId: v.string() }),
  async (dto) => {
    verifyAuth();
    await inventoryService.removeFromPurchaseList(dto.inventoryItemId);
    await getPurchaseList().refresh();
  },
);
