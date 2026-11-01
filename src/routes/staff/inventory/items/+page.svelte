<script lang="ts">
  import { goto } from '$app/navigation';
  import { Button } from '$lib/components/ui/button';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { Spinner } from '$lib/components/ui/spinner';
  import * as Table from '$lib/components/ui/table';
  import IconButton from '$lib/frontend/components/IconButton.svelte';
  import PageHeader from '$lib/frontend/components/PageHeader.svelte';
  import TextInput from '$lib/frontend/components/form/TextInput.svelte';
  import { submitWithToast } from '$lib/frontend/form-submit';
  import { modalManager } from '$lib/frontend/modal-manager.svelte';
  import { inventoryLabelsHref } from '$lib/frontend/inventory-labels';
  import { filterBySearch } from '$lib/frontend/search';
  import { TableSelection } from '$lib/frontend/table-selection.svelte';
  import type { InventoryItemDto } from '$lib/remotes/dtos/inventory.dto';
  import {
    addToPurchaseList,
    deleteInventoryItem,
    getInventoryItems,
  } from '$lib/remotes/endpoints/inventory.remote';
  import PencilIcon from '@lucide/svelte/icons/pencil';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import PrinterIcon from '@lucide/svelte/icons/printer';
  import SearchIcon from '@lucide/svelte/icons/search';
  import ShoppingCartPlusIcon from '@lucide/svelte/icons/shopping-cart-plus';
  import TrashIcon from '@lucide/svelte/icons/trash';
  import InventoryItemModal from './InventoryItemModal.svelte';

  let inventoryItems = getInventoryItems();
  let searchTerm = $state('');
  let searchedItems = $derived(
    filterBySearch(inventoryItems.current ?? [], searchTerm, ['name', 'vendor', 'description']),
  );

  const selection = new TableSelection(
    () => searchedItems,
    (item) => item.id,
  );

  function showCreateModal() {
    modalManager.show(InventoryItemModal, {});
  }

  function showEditModal(item: InventoryItemDto) {
    modalManager.show(InventoryItemModal, { itemId: item.id, prefill: item });
  }

  async function handleDeleteItem(id: string) {
    const confirm = await modalManager.confirm({
      title: 'Delete Inventory Item',
      prompt:
        'Are you sure you want to delete this item? It will also be removed from the purchase list.',
      confirmText: 'Delete',
      variant: 'destructive',
    });

    if (!confirm) return;

    const deleted = await submitWithToast(() => deleteInventoryItem({ id }), {
      success: 'Item deleted',
      error: 'Failed to delete item',
    });
    if (deleted) selection.deselect([id]);
  }

  // Handles the click itself so shift-click can select a range.
  function toggleItem(event: MouseEvent, item: (typeof searchedItems)[number]) {
    event.preventDefault();
    selection.toggle(item, !selection.has(item), event.shiftKey);
  }

  function handlePrintLabels() {
    if (selection.size === 0) return;
    goto(inventoryLabelsHref(selection.selectedRows.map((item) => item.id)));
  }

  async function handleAddToPurchaseList(item: InventoryItemDto) {
    await submitWithToast(() => addToPurchaseList({ inventoryItemId: item.id }), {
      success: `Added "${item.name}" to purchase list.`,
      error: 'Failed to add to purchase list',
    });
  }
</script>

<PageHeader title="Inventory Items">
  {#snippet actions()}
    <Button variant="outline" size="sm" disabled={selection.size === 0} onclick={handlePrintLabels}>
      <PrinterIcon />
      Print Labels{selection.size > 0 ? ` (${selection.size})` : ''}
    </Button>
    <Button size="sm" onclick={showCreateModal}>
      <PlusIcon />
      Add Item
    </Button>
  {/snippet}
</PageHeader>

<TextInput
  icon={SearchIcon}
  placeholder="Search Items"
  class="mb-3 sm:max-w-xs"
  bind:value={searchTerm}
/>

{#if inventoryItems.loading}
  <div class="flex justify-center py-8">
    <Spinner class="size-6" />
  </div>
{:else if inventoryItems.error}
  <p class="text-sm text-destructive">
    Error loading inventory items: {inventoryItems.error.message}
  </p>
{:else}
  <div class="overflow-hidden rounded-lg border">
    <Table.Root>
      <Table.Header class="bg-muted/50">
        <Table.Row>
          <Table.Head class="w-8"><span class="sr-only">Select</span></Table.Head>
          <Table.Head>Name</Table.Head>
          <Table.Head class="hidden md:table-cell">Vendor</Table.Head>
          <Table.Head class="hidden lg:table-cell">Description</Table.Head>
          <Table.Head class="w-28"><span class="sr-only">Actions</span></Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each searchedItems as item (item.id)}
          <Table.Row data-state={selection.has(item) ? 'selected' : undefined}>
            <Table.Cell>
              <Checkbox
                aria-label="Select {item.name}"
                checked={selection.has(item)}
                onclick={(event) => toggleItem(event, item)}
              />
            </Table.Cell>
            <Table.Cell class="max-w-48">
              <div class="truncate font-medium">{item.name}</div>
              <div class="truncate text-xs text-muted-foreground md:hidden">{item.vendor}</div>
            </Table.Cell>
            <Table.Cell class="hidden md:table-cell">{item.vendor}</Table.Cell>
            <Table.Cell class="hidden max-w-80 truncate lg:table-cell"
              >{item.description}</Table.Cell
            >
            <Table.Cell>
              <div class="flex justify-end gap-0.5">
                <IconButton
                  icon={ShoppingCartPlusIcon}
                  aria-label="Add Item to Purchase List"
                  onclick={() => handleAddToPurchaseList(item)}
                />
                <IconButton
                  icon={PencilIcon}
                  aria-label="Edit Item"
                  onclick={() => showEditModal(item)}
                />
                <IconButton
                  icon={TrashIcon}
                  aria-label="Delete Item"
                  class="text-destructive hover:text-destructive"
                  onclick={() => handleDeleteItem(item.id)}
                />
              </div>
            </Table.Cell>
          </Table.Row>
        {:else}
          <Table.Row>
            <Table.Cell colspan={5} class="h-20 text-center text-muted-foreground">
              No inventory items found.
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </div>
{/if}
