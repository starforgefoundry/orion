<script lang="ts">
  import { page } from '$app/state';
  import { getPrintRequests } from '$lib/remotes/endpoints/print_request.remote';
  import { Heading, IconButton, LoadingSpinner, modalManager } from '@immich/ui';
  import { mdiDeveloperBoard, mdiFormatListBulleted } from '@mdi/js';
  import { onMount } from 'svelte';
  import Kanban from './Kanban.svelte';
  import RequestDetailModal from './RequestDetailModal.svelte';
  import Table from './Table.svelte';

  let selectedMode: 'board' | 'list' = $state('board');
  let prints = getPrintRequests();

  // Open detail modal on page load if id is set
  onMount(() => {
    const id = page.url.searchParams.get('id');
    if (id) {
      modalManager.open(RequestDetailModal, {
        requestId: id,
      });
    }
  });
</script>

<svelte:head>
  <title>3D Print Requests | Orion</title>
</svelte:head>

<div class="mb-4 flex flex-row items-center justify-between">
  <Heading>3D Print Requests</Heading>
  <IconButton
    color="secondary"
    onclick={() => (selectedMode = selectedMode === 'board' ? 'list' : 'board')}
    shape="round"
    variant="ghost"
    aria-label="Switch Views"
    icon={selectedMode === 'board' ? mdiFormatListBulleted : mdiDeveloperBoard}
  />
</div>

<!-- Divider -->
<hr class="border-border-500 mb-4 border-t" />

{#if prints.loading}
  <div class="flex w-full flex-col items-center justify-center">
    <LoadingSpinner size="large" />
  </div>
{:else if prints.error}
  <p class="text-danger">Error loading print requests: {prints.error.message}</p>
{:else if selectedMode === 'board'}
  <Kanban />
{:else}
  <Table />
{/if}
