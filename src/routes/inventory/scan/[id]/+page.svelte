<script lang="ts">
  import { page } from '$app/state';
  import { addToPurchaseList } from '$lib/remotes/endpoints/inventory.remote';
  import { CardBody, CardHeader, CardTitle, Icon, LoadingSpinner, Text } from '@immich/ui';
  import { mdiAlertCircle, mdiCheckCircle, mdiPackageVariant } from '@mdi/js';
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

<CardHeader>
  <div class="flex items-center justify-start gap-2">
    <Icon icon={mdiPackageVariant} size="1.5rem" aria-hidden />
    <CardTitle>Inventory Item Scanned</CardTitle>
  </div>
</CardHeader>
<CardBody>
  {#if error}
    <div class="flex flex-col items-center justify-center text-center">
      <Icon icon={mdiAlertCircle} class="h-16 w-16 align-middle text-danger" />
      <h1 class="mb-2 text-3xl font-bold">Error</h1>

      <Text class="mb-6">{error}</Text>

      <Text color="muted">If you believe this is an error, please ask a staff member.</Text>
    </div>
  {:else if loading}
    <LoadingSpinner class="mx-auto" size="large" />
  {:else}
    <div class="flex flex-col items-center justify-center text-center">
      <Icon icon={mdiCheckCircle} class="h-16 w-16 align-middle text-success" />
      <h1 class="mb-6 text-3xl font-bold">Added to Purchase List</h1>

      <Text class="mb-6">This item has been added to the purchase list. Thanks!</Text>
    </div>
  {/if}
</CardBody>
