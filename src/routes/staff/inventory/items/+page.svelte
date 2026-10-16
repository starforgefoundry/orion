<script lang="ts">
  import { goto } from '$app/navigation';
  import { Button } from '$lib/components/ui/button';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { Spinner } from '$lib/components/ui/spinner';
  import * as Table from '$lib/components/ui/table';
  import IconButton from '$lib/frontend/components/IconButton.svelte';
  import PageHeader from '$lib/frontend/components/PageHeader.svelte';
  import TextInput from '$lib/frontend/components/form/TextInput.svelte';
  import { modalManager } from '$lib/frontend/modal-manager.svelte';
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
  import { toast } from 'svelte-sonner';
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

    const itemsToPrint = searchedItems.filter((item) => selectedItems.has(item.id));

    goto('/staff/inventory/labels?items=' + encodeURIComponent(JSON.stringify(itemsToPrint)));
  }

  async function handleAddToPurchaseList(item: InventoryItemDto) {
    await addToPurchaseList({ inventoryItemId: item.id });

    toast.success(`Added "${item.name}" to purchase list.`);
  }
</script>

<PageHeader title="Inventory Items">
  {#snippet actions()}
    <Button variant="outline" size="sm" disabled={selectedCount === 0} onclick={handlePrintLabels}>
      <PrinterIcon />
      Print Labels{selectedCount > 0 ? ` (${selectedCount})` : ''}
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
        {#each searchedItems as item, index (item.id)}
          <Table.Row data-state={selectedItems.has(item.id) ? 'selected' : undefined}>
            <Table.Cell>
              <Checkbox
                aria-label="Select {item.name}"
                checked={selectedItems.has(item.id)}
                onCheckedChange={(newValue) => handleCheckboxChange(item.id, index, newValue)}
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
