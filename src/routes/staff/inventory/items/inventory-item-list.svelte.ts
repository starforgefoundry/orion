import { goto } from '$app/navigation';
import { submitWithToast } from '$lib/frontend/form-submit';
import { modalManager } from '$lib/frontend/modal-manager.svelte';
import { filterBySearch } from '$lib/frontend/search';
import { TableSelection } from '$lib/frontend/table-selection.svelte';
import type { InventoryItemDto } from '$lib/remotes/dtos/inventory.dto';
import {
  addToPurchaseList,
  deleteInventoryItem,
  getInventoryItems,
} from '$lib/remotes/endpoints/inventory.remote';
import { inventoryLabelsHref } from '../inventory-labels';
import InventoryItemModal from './InventoryItemModal.svelte';

type InventoryItem = NonNullable<ReturnType<typeof getInventoryItems>['current']>[number];

export class InventoryItemList {
  searchTerm = $state('');

  readonly items = getInventoryItems();
  readonly results = $derived(
    filterBySearch(this.items.current ?? [], this.searchTerm, ['name', 'vendor', 'description']),
  );
  readonly selection = new TableSelection(
    () => this.results,
    (item) => item.id,
  );

  /** Handles the click itself so shift-click can select a range. */
  toggle(event: MouseEvent, item: InventoryItem) {
    event.preventDefault();
    this.selection.toggle(item, !this.selection.has(item), event.shiftKey);
  }

  printLabels() {
    if (this.selection.size === 0) return;
    goto(inventoryLabelsHref(this.selection.selectedRows.map((item) => item.id)));
  }

  create() {
    modalManager.show(InventoryItemModal, {});
  }

  edit(item: InventoryItemDto) {
    modalManager.show(InventoryItemModal, { itemId: item.id, prefill: item });
  }

  async remove(id: string) {
    const confirmed = await modalManager.confirm({
      title: 'Delete Inventory Item',
      prompt:
        'Are you sure you want to delete this item? It will also be removed from the purchase list.',
      confirmText: 'Delete',
      variant: 'destructive',
    });
    if (!confirmed) return;

    const deleted = await submitWithToast(() => deleteInventoryItem({ id }), {
      success: 'Item deleted',
      error: 'Failed to delete item',
    });
    if (deleted) this.selection.deselect([id]);
  }

  async addToPurchaseList(item: InventoryItemDto) {
    await submitWithToast(() => addToPurchaseList({ inventoryItemId: item.id }), {
      success: `Added "${item.name}" to purchase list.`,
      error: 'Failed to add to purchase list',
    });
  }
}
