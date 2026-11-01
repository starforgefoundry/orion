<script lang="ts">
  import { page } from '$app/state';
  import QrCode from '$lib/frontend/components/QrCode.svelte';
  import { INVENTORY_LABEL_ITEM_PARAM } from '$lib/frontend/inventory-labels';
  import { getInventoryItems } from '$lib/remotes/endpoints/inventory.remote';
  import { onMount, tick } from 'svelte';

  const itemsQuery = getInventoryItems();
  const itemIds = $derived(new Set(page.url.searchParams.getAll(INVENTORY_LABEL_ITEM_PARAM)));
  const items = $derived((itemsQuery.current ?? []).filter((item) => itemIds.has(item.id)));

  onMount(async () => {
    await itemsQuery;
    await tick();
    window.print();
  });
</script>

{#each items as item (item.id)}
  <div class="flex flex-col items-center justify-center bg-white">
    <h2 class="w-full text-center text-xl leading-none font-bold tracking-tight text-black">
      {item.name}
    </h2>
    <p class="-mt-2 w-full text-center text-black">{item.vendor}</p>
    <div class=" w-full border border-black"></div>
    <QrCode data={window.location.origin + '/inventory/scan/' + item.id} size={120} />

    <p class="w-full text-center text-xs text-black">{item.description}</p>
    <!-- <div class="flex h-full flex-1 flex-col justify-center overflow-hidden text-black">
        <div class="mb-1 line-clamp-2 overflow-hidden text-[14pt] font-bold text-ellipsis">
          {item.name}
        </div>
        <div class="overflow-hidden text-[10pt] text-ellipsis whitespace-nowrap">
          {item.vendor}
        </div>
      </div> -->
  </div>
{/each}

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: Arial, sans-serif;
  }

  @page {
    size: 3in 2in;
    margin: 0;
  }
</style>
