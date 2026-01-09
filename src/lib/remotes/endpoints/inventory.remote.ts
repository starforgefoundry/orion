import { command, form, query } from '$app/server';
import { createInventoryItemDto, updateInventoryItemDto } from '$lib/remotes/dtos/inventory.dto';
import { verifyAuth } from '$lib/remotes/utils';
import { inventoryService } from '$lib/server/services/inventory.service';
import * as v from 'valibot';

export const getInventoryItems = query(async () => {
  verifyAuth();
  return await inventoryService.getInventoryItems();
});

export const getInventoryItemById = query(v.object({ id: v.string() }), async (dto) => {
  verifyAuth();
  return await inventoryService.getInventoryItemById(dto.id);
});

export const createInventoryItem = form(createInventoryItemDto, async (data) => {
  verifyAuth();
  const item = await inventoryService.createInventoryItem(data);
  await getInventoryItems().refresh();
  return item;
});

export const updateInventoryItem = command(updateInventoryItemDto, async (dto) => {
  verifyAuth();
  const { id, ...updates } = dto;
  const item = await inventoryService.updateInventoryItem(id, updates);
  await getInventoryItems().refresh();
  await getPurchaseList().refresh();
  return item;
});

export const deleteInventoryItem = command(v.object({ id: v.string() }), async (dto) => {
  verifyAuth();
  await inventoryService.deleteInventoryItem(dto.id);
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
  await getPurchaseList().refresh();
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

export const uploadInventoryImage = command(
  v.object({ id: v.string(), image: v.file() }),
  async (dto) => {
    verifyAuth();
    const result = await inventoryService.uploadInventoryImage(dto.id, dto.image);
    await getInventoryItems().refresh();
    return result;
  },
);

export const deleteInventoryImage = command(v.object({ id: v.string() }), async (dto) => {
  verifyAuth();
  await inventoryService.deleteInventoryImage(dto.id);
  await getInventoryItems().refresh();
});
