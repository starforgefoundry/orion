<script lang="ts">
  import { page } from '$app/state';
  import QRCode from '@castlenine/svelte-qrcode';
  import { Heading, Text } from '@immich/ui';
  import { onMount } from 'svelte';

  type TagLabel = { name: string; tagId: string; colorHex: string | null };

  let labels = $derived.by(() => {
    const json = page.url.searchParams.get('tags');
    return (json ? JSON.parse(json) : []) as TagLabel[];
  });

  onMount(() => {
    window.print();
  });
</script>

{#each labels as label}
  <div class="flex h-full flex-col items-center justify-center bg-white">
    <Heading class="w-full text-center text-black">{label.name}</Heading>
    {#if label.colorHex}
      <div
        class="mt-1 h-3 w-24 border border-black"
        style={`background-color: ${label.colorHex}`}
      ></div>
    {/if}
    <QRCode data={label.tagId} size={140} />
    <Text class="w-full text-center font-mono text-black">{label.tagId}</Text>
  </div>
{/each}

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: Arial, sans-serif;
  }

  @page {
    size: 2in 2in;
    margin: 0;
  }
</style>
