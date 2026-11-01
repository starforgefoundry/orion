import { goto } from '$app/navigation';
import { modalManager } from '$lib/frontend/modal-manager.svelte';
import { deleteInventoryItem, getInventoryItems } from '$lib/remotes/endpoints/inventory.remote';
import { describe, expect, it, vi } from 'vitest';
import { inventoryLabelsHref } from '../inventory-labels';
import { InventoryItemList } from './inventory-item-list.svelte';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

vi.mock('$lib/remotes/endpoints/inventory.remote', () => ({
  addToPurchaseList: vi.fn(),
  deleteInventoryItem: vi.fn(),
  getInventoryItems: vi.fn(),
}));

vi.mock('$lib/frontend/modal-manager.svelte', () => ({
  modalManager: { confirm: vi.fn(), show: vi.fn() },
}));

vi.mock('$lib/frontend/form-submit', () => ({
  submitWithToast: async (action: () => Promise<unknown>) => {
    await action();
    return true;
  },
}));

function item(id: string, name: string) {
  return { id, name, vendor: 'Acme', url: '', imageUrl: null, description: '' };
}

const BOLTS = item('bolts', 'M3 Bolts');
const NUTS = item('nuts', 'M3 Nuts');
const GLUE = item('glue', 'Wood Glue');

function listWith(items = [BOLTS, NUTS, GLUE]) {
  vi.mocked(getInventoryItems).mockReturnValue({
    current: items,
  } as unknown as ReturnType<typeof getInventoryItems>);
  return new InventoryItemList();
}

function click(shiftKey = false) {
  return { preventDefault: vi.fn(), shiftKey } as unknown as MouseEvent;
}

describe(InventoryItemList.name, () => {
  it('filters items by search', () => {
    const list = listWith();

    list.searchTerm = 'M3';

    expect(list.results.map((row) => row.id)).toEqual([BOLTS.id, NUTS.id]);
  });

  it('selects a range with shift-click', () => {
    const list = listWith();

    list.toggle(click(), BOLTS);
    list.toggle(click(true), GLUE);

    expect(list.selection.size).toBe(3);
  });

  it('prints labels for the selected items', () => {
    const list = listWith();
    list.toggle(click(), NUTS);

    list.printLabels();

    expect(goto).toHaveBeenCalledWith(inventoryLabelsHref([NUTS.id]));
  });

  it('does not print labels with nothing selected', () => {
    const list = listWith();

    list.printLabels();

    expect(goto).not.toHaveBeenCalled();
  });

  it('deselects an item once deleted', async () => {
    vi.mocked(modalManager.confirm).mockResolvedValue(true);
    const list = listWith();
    list.toggle(click(), BOLTS);

    await list.remove(BOLTS.id);

    expect(deleteInventoryItem).toHaveBeenCalledWith({ id: BOLTS.id });
    expect(list.selection.size).toBe(0);
  });
});
