<script lang="ts">
  import { page } from '$app/state';
  import * as ToggleGroup from '$lib/components/ui/toggle-group';
  import PageHeader from '$lib/frontend/components/PageHeader.svelte';
  import type { EnumValue } from '$lib/utils/enum';
  import KanbanIcon from '@lucide/svelte/icons/square-kanban';
  import ListIcon from '@lucide/svelte/icons/list';
  import { onMount, type Snippet } from 'svelte';

  const VIEW_MODES = { BOARD: 'board', LIST: 'list' } as const;
  type ViewMode = EnumValue<typeof VIEW_MODES>;

  type Props = {
    title: string;
    formHref?: string;
    /** Reopens the request named in the URL, so a reload keeps it open. */
    openRequest: (id: string) => void;
    board: Snippet;
    list: Snippet;
  };

  let { title, formHref, openRequest, board, list }: Props = $props();

  let selectedMode: ViewMode = $state(VIEW_MODES.BOARD);

  onMount(() => {
    const id = page.url.searchParams.get('id');
    if (id) openRequest(id);
  });
</script>

<PageHeader {title} {formHref}>
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
  {@render board()}
{:else}
  {@render list()}
{/if}
