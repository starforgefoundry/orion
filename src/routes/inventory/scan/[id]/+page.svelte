<script lang="ts">
  import { page } from '$app/state';
  import * as Card from '$lib/components/ui/card';
  import { Spinner } from '$lib/components/ui/spinner';
  import { addToPurchaseList } from '$lib/remotes/endpoints/inventory.remote';
  import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
  import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
  import PackageIcon from '@lucide/svelte/icons/package';
  import { onMount } from 'svelte';

  let error = $state<string | null>(null);
  let loading = $state(true);

  onMount(async () => {
    try {
      await addToPurchaseList({ inventoryItemId: page.params.id ?? '' });
    } catch (e) {
      console.log(e);
      error = 'Failed to add item to purchase list. Please try again.';
    } finally {
      loading = false;
    }
  });
</script>

<Card.Header>
  <Card.Title class="flex items-center gap-2">
    <PackageIcon class="size-4 text-muted-foreground" aria-hidden="true" />
    Inventory Item Scanned
  </Card.Title>
</Card.Header>
<Card.Content>
  {#if error}
    <div class="flex flex-col items-center gap-2 py-4 text-center">
      <CircleAlertIcon class="size-12 text-destructive" />
      <h1 class="text-xl font-semibold">Error</h1>
      <p>{error}</p>
      <p class="text-muted-foreground">
        If you believe this is an error, please ask a staff member.
      </p>
    </div>
  {:else if loading}
    <Spinner class="mx-auto my-6 size-8" />
  {:else}
    <div class="flex flex-col items-center gap-2 py-4 text-center">
      <CircleCheckIcon class="size-12 text-success" />
      <h1 class="text-xl font-semibold">Added to Purchase List</h1>
      <p class="text-muted-foreground">This item has been added to the purchase list. Thanks!</p>
    </div>
  {/if}
</Card.Content>
