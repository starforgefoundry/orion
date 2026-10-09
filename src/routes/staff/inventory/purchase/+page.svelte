<script lang="ts">
  import { getPurchaseList, removeFromPurchaseList } from '$lib/remotes/endpoints/inventory.remote';
  import {
    Button,
    Heading,
    IconButton,
    LoadingSpinner,
    Table,
    TableBody,
    TableCell,
    TableHeader,
    TableHeading,
    TableRow,
    toastManager,
  } from '@immich/ui';
  import { mdiCheck, mdiOpenInNew } from '@mdi/js';

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
    await removeFromPurchaseList({ inventoryItemId });
    toastManager.success('Item marked as purchased.');
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

        <Table striped class="mt-4">
          <TableHeader>
            <TableHeading class="w-4/12">Item</TableHeading>
            <TableHeading class="w-5/12">Description</TableHeading>
            <TableHeading class="w-2/12">Added</TableHeading>
            <TableHeading class="w-1/12">Actions</TableHeading>
          </TableHeader>
          <TableBody>
            {#each items as item}
              {#if item.inventoryItem}
                <TableRow>
                  <TableCell class="w-4/12 px-4 text-left">
                    <button
                      class="text-primary hover:underline"
                      onclick={() => openUrl(item.inventoryItem!.url)}
                    >
                      {item.inventoryItem.name}
                    </button>
                  </TableCell>
                  <TableCell class="w-5/12 truncate px-4 text-left">
                    {item.inventoryItem.description}
                  </TableCell>
                  <TableCell class="w-2/12 px-4 text-left">
                    {item.addedDate ? new Date(item.addedDate).toLocaleDateString() : 'N/A'}
                  </TableCell>
                  <TableCell class="w-1/12">
                    <div class="flex justify-center">
                      <IconButton
                        icon={mdiCheck}
                        aria-label="Mark as Purchased"
                        color="success"
                        onclick={() => handleRemoveFromList(item.inventoryItemId)}
                      />
                    </div>
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
