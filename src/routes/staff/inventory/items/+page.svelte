<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { Spinner } from '$lib/components/ui/spinner';
  import * as Table from '$lib/components/ui/table';
  import IconButton from '$lib/frontend/components/IconButton.svelte';
  import PageHeader from '$lib/frontend/components/PageHeader.svelte';
  import TextInput from '$lib/frontend/components/form/TextInput.svelte';
  import PencilIcon from '@lucide/svelte/icons/pencil';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import PrinterIcon from '@lucide/svelte/icons/printer';
  import SearchIcon from '@lucide/svelte/icons/search';
  import ShoppingCartPlusIcon from '@lucide/svelte/icons/shopping-cart-plus';
  import TrashIcon from '@lucide/svelte/icons/trash';
  import { InventoryItemList } from './inventory-item-list.svelte';

  const COLUMN_COUNT = 5;

  const list = new InventoryItemList();
  const selection = list.selection;
</script>

<PageHeader title="Inventory Items">
  {#snippet actions()}
    <Button
      variant="outline"
      size="sm"
      disabled={selection.size === 0}
      onclick={() => list.printLabels()}
    >
      <PrinterIcon />
      Print Labels{selection.size > 0 ? ` (${selection.size})` : ''}
    </Button>
    <Button size="sm" onclick={() => list.create()}>
      <PlusIcon />
      Add Item
    </Button>
  {/snippet}
</PageHeader>

<TextInput
  icon={SearchIcon}
  placeholder="Search Items"
  class="mb-3 sm:max-w-xs"
  bind:value={list.searchTerm}
/>

{#if list.items.loading}
  <div class="flex justify-center py-8">
    <Spinner class="size-6" />
  </div>
{:else if list.items.error}
  <p class="text-sm text-destructive">
    Error loading inventory items: {list.items.error.message}
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
        {#each list.results as item (item.id)}
          <Table.Row data-state={selection.has(item) ? 'selected' : undefined}>
            <Table.Cell>
              <Checkbox
                aria-label="Select {item.name}"
                checked={selection.has(item)}
                onclick={(event) => list.toggle(event, item)}
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
                  onclick={() => list.addToPurchaseList(item)}
                />
                <IconButton
                  icon={PencilIcon}
                  aria-label="Edit Item"
                  onclick={() => list.edit(item)}
                />
                <IconButton
                  icon={TrashIcon}
                  aria-label="Delete Item"
                  class="text-destructive hover:text-destructive"
                  onclick={() => list.remove(item.id)}
                />
              </div>
            </Table.Cell>
          </Table.Row>
        {:else}
          <Table.Row>
            <Table.Cell colspan={COLUMN_COUNT} class="h-20 text-center text-muted-foreground">
              No inventory items found.
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </div>
{/if}
