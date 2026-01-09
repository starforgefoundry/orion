<script lang="ts">
  import {
    Table,
    TableBody,
    TableCell,
    TableHeader,
    TableHeaderCell,
    TableRow,
  } from '$lib/frontend/components/table';
  import { getPurchaseList, removeFromPurchaseList } from '$lib/remotes/endpoints/inventory.remote';
  import { Button, Heading, IconButton, LoadingSpinner, modalManager } from '@immich/ui';
  import { mdiChatQuestion, mdiOpenInNew, mdiTrashCan } from '@mdi/js';

  let purchaseList = getPurchaseList();

  // Group items by vendor
  let groupedByVendor = $derived.by(() => {
    const groups = new Map<string, typeof purchaseList.current>();

    purchaseList.current?.forEach((item) => {
      if (item.inventoryItem) {
        const vendor = item.inventoryItem.vendor;
        if (!groups.has(vendor)) {
          groups.set(vendor, []);
        }
        groups.get(vendor)!.push(item);
      }
    });

    return groups;
  });

  async function handleRemoveFromList(inventoryItemId: string) {
    const confirm = await modalManager.showDialog({
      title: 'Remove from Purchase List',
      prompt: 'Are you sure you want to remove this item from the purchase list?',
      confirmText: 'Remove',
      confirmColor: 'danger',
      icon: mdiChatQuestion,
    });

    if (confirm) {
      await removeFromPurchaseList({ inventoryItemId });
    }
  }

  function openUrl(url: string) {
    window.open(url, '_blank');
  }
</script>

<div class="mb-6">
  <Heading size="large" class="inline-block w-fit">Purchase List</Heading>
</div>

{#if purchaseList.loading}
  <div class="flex justify-center">
    <LoadingSpinner size="large" />
  </div>
{:else if purchaseList.error}
  <p class="text-danger">Error loading purchase list: {purchaseList.error.message}</p>
{:else if groupedByVendor.size === 0}
  <p class="text-center text-gray-500">No items need purchasing.</p>
{:else}
  <div class="flex flex-col gap-6">
    {#each [...groupedByVendor.entries()] as [vendor, items]}
      <div class="rounded-lg border border-gray-200 p-4">
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-lg font-bold">{vendor}</h3>
        </div>

        <Table>
          <TableHeader>
            <TableHeaderCell width="w-4/12">Item</TableHeaderCell>
            <TableHeaderCell width="w-5/12">Description</TableHeaderCell>
            <TableHeaderCell width="w-2/12">Added</TableHeaderCell>
            <TableHeaderCell width="w-1/12">Actions</TableHeaderCell>
          </TableHeader>
          <TableBody>
            {#each items as item}
              {#if item.inventoryItem}
                <TableRow>
                  <TableCell width="w-4/12" align="left" class="pl-6">
                    <button
                      class="text-primary hover:underline"
                      onclick={() => openUrl(item.inventoryItem!.url)}
                    >
                      {item.inventoryItem.name}
                    </button>
                  </TableCell>
                  <TableCell width="w-5/12" align="left" class="truncate">
                    {item.inventoryItem.description}
                  </TableCell>
                  <TableCell width="w-2/12" align="left">
                    {item.addedDate ? new Date(item.addedDate).toLocaleDateString() : 'N/A'}
                  </TableCell>
                  <TableCell width="w-1/12" class="flex justify-center">
                    <IconButton
                      icon={mdiTrashCan}
                      aria-label="Remove from List"
                      color="danger"
                      onclick={() => handleRemoveFromList(item.inventoryItemId)}
                    />
                  </TableCell>
                </TableRow>
              {/if}
            {/each}
          </TableBody>
        </Table>

        <div class="mt-4 flex justify-end">
          <Button
            variant="filled"
            leadingIcon={mdiOpenInNew}
            onclick={() => {
              items?.forEach((item) => {
                if (item.inventoryItem?.url) {
                  window.open(item.inventoryItem.url, '_blank');
                }
              });
            }}
          >
            Open All Items in Browser
          </Button>
        </div>
      </div>
    {/each}
  </div>
{/if}
