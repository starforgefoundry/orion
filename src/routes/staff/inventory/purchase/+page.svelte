<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Spinner } from '$lib/components/ui/spinner';
  import * as Table from '$lib/components/ui/table';
  import IconButton from '$lib/frontend/components/IconButton.svelte';
  import PageHeader from '$lib/frontend/components/PageHeader.svelte';
  import Section from '$lib/frontend/components/Section.svelte';
  import { getPurchaseList, removeFromPurchaseList } from '$lib/remotes/endpoints/inventory.remote';
  import CheckIcon from '@lucide/svelte/icons/check';
  import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
  import { toast } from 'svelte-sonner';

  let purchaseList = getPurchaseList();

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
    toast.success('Item marked as purchased.');
  }

  function openUrl(url: string) {
    window.open(url, '_blank');
  }
</script>

<PageHeader title="Purchase List" />

{#if purchaseList.loading}
  <div class="flex justify-center py-8">
    <Spinner class="size-6" />
  </div>
{:else if purchaseList.error}
  <p class="text-sm text-destructive">Error loading purchase list: {purchaseList.error.message}</p>
{:else if groupedByVendor.size === 0}
  <p class="py-8 text-center text-sm text-muted-foreground">No items need purchasing.</p>
{:else}
  <div class="flex flex-col gap-4">
    {#each [...groupedByVendor.entries()] as [vendor, items] (vendor)}
      <Section title={vendor} class="overflow-hidden [&>div]:p-0">
        {#snippet actions()}
          <Button
            variant="ghost"
            size="sm"
            onclick={() => {
              items?.forEach((item) => {
                if (item.inventoryItem?.url) {
                  window.open(item.inventoryItem.url, '_blank');
                }
              });
            }}
          >
            <ExternalLinkIcon />
            Open All
          </Button>
        {/snippet}
        <Table.Root>
          <Table.Header class="bg-muted/50">
            <Table.Row>
              <Table.Head>Item</Table.Head>
              <Table.Head class="hidden md:table-cell">Description</Table.Head>
              <Table.Head class="hidden sm:table-cell">Added</Table.Head>
              <Table.Head class="w-12"><span class="sr-only">Actions</span></Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each items ?? [] as item (item.inventoryItemId)}
              {#if item.inventoryItem}
                <Table.Row>
                  <Table.Cell class="max-w-48">
                    <button
                      class="block max-w-full truncate text-left font-medium text-primary hover:underline"
                      onclick={() => openUrl(item.inventoryItem!.url)}
                    >
                      {item.inventoryItem.name}
                    </button>
                    <div class="truncate text-xs text-muted-foreground md:hidden">
                      {item.inventoryItem.description}
                    </div>
                  </Table.Cell>
                  <Table.Cell class="hidden max-w-64 truncate md:table-cell">
                    {item.inventoryItem.description}
                  </Table.Cell>
                  <Table.Cell class="hidden sm:table-cell">
                    {item.addedDate ? new Date(item.addedDate).toLocaleDateString() : 'N/A'}
                  </Table.Cell>
                  <Table.Cell class="text-right">
                    <IconButton
                      icon={CheckIcon}
                      aria-label="Mark as Purchased"
                      class="text-success"
                      onclick={() => handleRemoveFromList(item.inventoryItemId)}
                    />
                  </Table.Cell>
                </Table.Row>
              {/if}
            {/each}
          </Table.Body>
        </Table.Root>
      </Section>
    {/each}
  </div>
{/if}
