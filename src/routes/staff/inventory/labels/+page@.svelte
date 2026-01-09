<script lang="ts">
  import { page } from '$app/state';
  import type { InventoryItemDto } from '$lib/remotes/dtos/inventory.dto';
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

{#each items as item}
  <div class="label">
    <div class="label-content">
      <img
        src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data={encodeURIComponent(
          window.location.origin + '/inventory/request/' + item.id,
        )}"
        alt="QR Code"
        class="qr-code"
      />
      <div class="label-text">
        <div class="item-name">{item.name}</div>
        <div class="item-vendor">{item.vendor}</div>
      </div>
    </div>
  </div>
  <div class="break-after-all"></div>
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

  .label {
    width: 3in;
    height: 2in;
    page-break-after: always;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.1in;
    box-sizing: border-box;
  }

  .label:last-child {
    page-break-after: auto;
  }

  .label-content {
    display: flex;
    align-items: center;
    gap: 0.15in;
    width: 100%;
    height: 100%;
  }

  .qr-code {
    width: 1.5in;
    height: 1.5in;
    object-fit: contain;
  }

  .label-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    overflow: hidden;
  }

  .item-name {
    font-size: 14pt;
    font-weight: bold;
    margin-bottom: 0.05in;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .item-vendor {
    font-size: 10pt;
    color: #666;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
