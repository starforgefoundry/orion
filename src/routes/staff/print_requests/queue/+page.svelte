<script lang="ts">
  import { page } from '$app/state';
  import * as ToggleGroup from '$lib/components/ui/toggle-group';
  import PageHeader from '$lib/frontend/components/PageHeader.svelte';
  import { modalManager } from '$lib/frontend/modal-manager.svelte';
  import { getPrintRequests } from '$lib/remotes/endpoints/print_request.remote';
  import KanbanIcon from '@lucide/svelte/icons/square-kanban';
  import ListIcon from '@lucide/svelte/icons/list';
  import { onMount } from 'svelte';
  import Kanban from './Kanban.svelte';
  import RequestDetailModal from './RequestDetailModal.svelte';
  import Table from './Table.svelte';

  const VIEW_MODES = { BOARD: 'board', LIST: 'list' } as const;
  type ViewMode = (typeof VIEW_MODES)[keyof typeof VIEW_MODES];

  let selectedMode: ViewMode = $state(VIEW_MODES.BOARD);

  onMount(() => {
    const id = page.url.searchParams.get('id');
    if (id) {
      modalManager.show(RequestDetailModal, { requestId: id });
    }
  });
</script>

<svelte:window onfocus={() => getPrintRequests().refresh()} />

<PageHeader title="Request Queue" formHref="/print_request/form">
  {#snippet actions()}
    <ToggleGroup.Root
      type="single"
      variant="outline"
      size="sm"
      value={selectedMode}
      onValueChange={(value) => value && (selectedMode = value as ViewMode)}
    >
      <ToggleGroup.Item value={VIEW_MODES.BOARD} aria-label="Board view">
        <KanbanIcon />
      </ToggleGroup.Item>
      <ToggleGroup.Item value={VIEW_MODES.LIST} aria-label="List view">
        <ListIcon />
      </ToggleGroup.Item>
    </ToggleGroup.Root>
  {/snippet}
</PageHeader>

{#if selectedMode === VIEW_MODES.BOARD}
  <Kanban />
{:else}
  <Table />
{/if}
