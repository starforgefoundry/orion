<script lang="ts">
  import { goto } from '$app/navigation';
  import type { InventoryItemDto } from '$lib/remotes/dtos/inventory.dto';
  import {
    addToPurchaseList,
    deleteInventoryItem,
    getInventoryItems,
  } from '$lib/remotes/endpoints/inventory.remote';
  import {
    Checkbox,
    Heading,
    IconButton,
    Input,
    LoadingSpinner,
    modalManager,
    Table,
    TableBody,
    TableCell,
    TableHeader,
    TableHeading,
    TableRow,
    toastManager,
  } from '@immich/ui';
  import {
    mdiChatQuestion,
    mdiMagnify,
    mdiPencil,
    mdiPlus,
    mdiPrinter,
    mdiTrashCan,
  } from '@mdi/js';
  import InventoryItemModal from './InventoryItemModal.svelte';

  let inventoryItems = getInventoryItems();
  let searchTerm = $state('');
  let searchedItems = $derived(
    inventoryItems.current?.filter(
      (item) =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.vendor.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description.toLowerCase().includes(searchTerm.toLowerCase()),
    ) || [],
  );

  let selectedItems = $state<Set<string>>(new Set());
  let selectedCount = $derived(selectedItems.size);
  let lastSelectedIndex = $state<number | null>(null);

  function showCreateModal() {
    modalManager.show(InventoryItemModal, {});
  }

  function showEditModal(item: InventoryItemDto) {
    // @ts-ignore - modalManager type doesn't support our CreateOrUpdate pattern
    modalManager.show(InventoryItemModal, { itemId: item.id, prefill: item });
  }

  async function handleDeleteItem(id: string) {
    const confirm = await modalManager.showDialog({
      title: 'Delete Inventory Item',
      prompt:
        'Are you sure you want to delete this item? It will also be removed from the purchase list.',
      confirmText: 'Delete',
      confirmColor: 'danger',
      icon: mdiChatQuestion,
    });

    if (confirm) {
      await deleteInventoryItem({ id });
      const newSelected = new Set(selectedItems);
      newSelected.delete(id);
      selectedItems = newSelected;
    }
  }

  function handleCheckboxChange(id: string, index: number, isChecked: boolean) {
    const shiftKey = (event as any).shiftKey;

    if (shiftKey && lastSelectedIndex !== null && searchedItems.length > 0) {
      // Shift-click: select range
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      const newSelected = new Set(selectedItems);
      for (let i = start; i <= end; i++) {
        if (searchedItems[i]) {
          if (isChecked) {
            newSelected.add(searchedItems[i].id);
          } else {
            newSelected.delete(searchedItems[i].id);
          }
        }
      }
      selectedItems = newSelected;
    } else {
      // Normal click
      const newSelected = new Set(selectedItems);
      if (isChecked) {
        newSelected.add(id);
      } else {
        newSelected.delete(id);
      }
      selectedItems = newSelected;
      lastSelectedIndex = index;
    }
  }

  async function handlePrintLabels() {
    if (selectedItems.size === 0) return;

    // Get the selected inventory items
    const itemsToPrint = searchedItems.filter((item) => selectedItems.has(item.id));

    goto('/staff/inventory/labels?items=' + encodeURIComponent(JSON.stringify(itemsToPrint)));
  }

  async function handleAddToPurchaseList(item: InventoryItemDto) {
    await addToPurchaseList({ inventoryItemId: item.id });

    toastManager.success(`Added "${item.name}" to purchase list.`);
  }
</script>

<div class="mb-6 flex items-center justify-between">
  <Heading size="large" class="inline-block w-fit">Inventory Items</Heading>
  <div class="flex w-1/2 items-center gap-2">
    <IconButton
      class="min-w-10"
      icon={mdiPrinter}
      color="success"
      aria-label="Print Labels"
      disabled={selectedCount === 0}
      onclick={handlePrintLabels}
    />
    <IconButton
      icon={mdiPlus}
      variant="filled"
      aria-label="Add Inventory Item"
      class="min-w-10"
      onclick={showCreateModal}
    />
    <Input placeholder="Search Items" leadingIcon={mdiMagnify} bind:value={searchTerm} />
  </div>
</div>

{#if inventoryItems.loading}
  <div class="flex justify-center">
    <LoadingSpinner size="large" />
  </div>
{:else if inventoryItems.error}
  <p class="text-danger">Error loading inventory items: {inventoryItems.error.message}</p>
{:else}
  <Table striped class="mt-4">
    <TableHeader>
      <TableHeading class="w-1/12"></TableHeading>
      <TableHeading class="w-3/12">Name</TableHeading>
      <TableHeading class="w-2/12">Vendor</TableHeading>
      <TableHeading class="w-4/12">Description</TableHeading>
      <TableHeading class="w-2/12">Actions</TableHeading>
    </TableHeader>
    <TableBody>
      {#each searchedItems as item, index}
        <TableRow>
          <TableCell class="w-1/12">
            <Checkbox
              checked={selectedItems.has(item.id)}
              onCheckedChange={(newValue) => handleCheckboxChange(item.id, index, newValue)}
            />
          </TableCell>
          <TableCell class="w-3/12 px-4 text-left">{item.name}</TableCell>
          <TableCell class="w-2/12 px-4 text-left">{item.vendor}</TableCell>
          <TableCell class="w-4/12 truncate px-4 text-left">{item.description}</TableCell>
          <TableCell class="w-2/12">
            <div class="flex justify-center gap-2">
              <IconButton
                icon={mdiPlus}
                color="success"
                aria-label="Add Item to Purchase List"
                onclick={() => handleAddToPurchaseList(item)}
              />
              <IconButton
                icon={mdiPencil}
                aria-label="Edit Item"
                onclick={() => showEditModal(item)}
              />
              <IconButton
                icon={mdiTrashCan}
                aria-label="Delete Item"
                color="danger"
                onclick={() => handleDeleteItem(item.id)}
              />
            </div>
          </TableCell>
        </TableRow>
      {/each}

      {#if searchedItems.length === 0}
        <TableRow>
          <TableCell class="w-full text-center">No inventory items found.</TableCell>
        </TableRow>
      {/if}
    </TableBody>
  </Table>
{/if}
