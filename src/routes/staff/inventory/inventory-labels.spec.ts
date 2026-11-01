import { describe, expect, it } from 'vitest';
import { INVENTORY_LABEL_ITEM_PARAM, inventoryLabelsHref } from './inventory-labels';

describe(inventoryLabelsHref.name, () => {
  it('lists each item id as its own query param', () => {
    const href = inventoryLabelsHref(['a1', 'b2']);
    const url = new URL(href, 'https://orion.example.com');

    expect(url.pathname).toBe('/staff/inventory/labels');
    expect(url.searchParams.getAll(INVENTORY_LABEL_ITEM_PARAM)).toEqual(['a1', 'b2']);
  });
});
