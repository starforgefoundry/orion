import { command, form, query } from '$app/server';
import { upsertInventoryItemDto } from '$lib/remotes/dtos/inventory.dto';
import { exposeUserErrors, staffOnly } from '$lib/server/remote-utils';
import { inventoryService } from '$lib/server/services/inventory.service';
import * as v from 'valibot';

export const getInventoryItems = query(staffOnly(() => inventoryService.getItems()));

export const upsertInventoryItem = form(
  upsertInventoryItemDto,
  staffOnly(async (data) => {
    const item = await inventoryService.upsertItem(data);
    await getInventoryItems().refresh();
    return item;
  }),
);

export const deleteInventoryItem = command(
  v.object({ id: v.string() }),
  staffOnly(async (dto) => {
    await inventoryService.deleteItem(dto.id);
    await getInventoryItems().refresh();
    await getPurchaseList().refresh();
  }),
);

export const getPurchaseList = query(staffOnly(() => inventoryService.getPurchaseList()));

export const addToPurchaseList = command(
  v.object({ inventoryItemId: v.string() }),
  exposeUserErrors(async (dto) => {
    // No auth required for this - QR code scanning
    const item = await inventoryService.addToPurchaseList(dto.inventoryItemId);
    return item;
  }),
);

export const removeFromPurchaseList = command(
  v.object({ inventoryItemId: v.string() }),
  staffOnly(async (dto) => {
    await inventoryService.removeFromPurchaseList(dto.inventoryItemId);
    await getPurchaseList().refresh();
  }),
);
