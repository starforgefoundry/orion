<script lang="ts">
  import { page } from '$app/state';
  import type { InventoryItemDto } from '$lib/remotes/dtos/inventory.dto';
  import QRCode from '@castlenine/svelte-qrcode';
  import { Heading, Text } from '@immich/ui';
  import { onMount } from 'svelte';

  let items = $derived.by(() => {
    const itemJSON = page.url.searchParams.get('items');
    return (itemJSON ? JSON.parse(itemJSON) : []) as InventoryItemDto[];
  });

  onMount(() => {
    // Trigger print dialog on mount
    window.print();
  });
</script>

{#each items as item, index}
  <div class="flex flex-col items-center justify-center">
    <Heading class="w-full text-center text-black">{item.name}</Heading>
    <Text class="w-full text-center text-black">{item.vendor}</Text>
    <div class="my-2 w-full border border-black"></div>
    <QRCode data={window.location.origin + '/inventory/scan/' + item.id} size={84} />

    <Text class="mt-2 w-full text-center text-black" size="tiny">{item.description}</Text>
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
