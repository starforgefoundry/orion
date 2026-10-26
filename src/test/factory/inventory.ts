import type { InventoryItem, PurchaseList } from '$lib/server/db/schema';
import { DateTime } from 'luxon';
import { newId } from './id';

export function inventoryItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: newId(),
    name: 'PLA Filament',
    vendor: 'Bambu Lab',
    url: 'https://example.com/pla',
    imageUrl: null,
    description: '1kg spool',
    ...overrides,
  };
}

export function purchaseList(overrides: Partial<PurchaseList> = {}): PurchaseList {
  return {
    id: newId(),
    inventoryItemId: newId(),
    addedDate: DateTime.now(),
    ...overrides,
  };
}
