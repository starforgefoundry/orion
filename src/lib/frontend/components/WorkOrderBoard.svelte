<script lang="ts" module>
  import type { KanbanColumnStyle } from '$lib/frontend/kanban-drag.svelte';

  /** Columns run left to right from waiting, to being worked on, to finished. */
  export const BOARD_COLUMN_STYLE = {
    WAITING: {
      dot: 'bg-muted-foreground',
      column: 'bg-muted/40',
      card: 'bg-card hover:border-foreground/25',
    },
    WORKING: {
      dot: 'bg-info',
      column: 'border-info/20 bg-info/5',
      card: 'border-info/20 bg-info/10 hover:border-info/50',
    },
    FINISHED: {
      dot: 'bg-success',
      column: 'border-success/20 bg-success/5',
      card: 'border-success/20 bg-success/10 hover:border-success/50',
    },
  } satisfies Record<string, KanbanColumnStyle>;
</script>

<script lang="ts" generics="Item, Column extends string">
  import { cn } from '$lib/frontend/cn';
  import { KanbanDrag, type KanbanColumn } from '$lib/frontend/kanban-drag.svelte';
  import { pollQuery } from '$lib/frontend/poll-query.svelte';
  import type { Snippet } from 'svelte';
  import { untrack } from 'svelte';
  import { MediaQuery } from 'svelte/reactivity';

  type Props = {
    columns: KanbanColumn<Column>[];
    items: Item[];
    /** Refreshed in the background, except while a card is mid-drag. */
    query: { refresh(): Promise<void> };
    itemId: (item: Item) => string;
    itemColumn: (item: Item) => string;
    canDrag?: (item: Item) => boolean;
    onMove: (item: Item, column: Column) => unknown;
    onOpen: (item: Item) => void;
    card: Snippet<[Item]>;
  };

  let {
    columns,
    items,
    query,
    itemId,
    itemColumn,
    canDrag = () => true,
    onMove,
    onOpen,
    card,
  }: Props = $props();

  // Touch devices use the long-press drag instead of native drag and drop.
  const hasMouse = new MediaQuery('pointer: fine');

  const drag = new KanbanDrag(
    untrack(() => columns.map((column) => column.id)),
    async (id, column) => {
      const item = items.find((candidate) => itemId(candidate) === id);
      if (item) await onMove(item, column);
    },
  );

  pollQuery(() => query, { isPaused: () => drag.draggedId !== null });

  let scrollContainer = $state<HTMLElement>();
  $effect(() => drag.setScrollContainer(scrollContainer));
</script>

<div
  class="-m-1 flex flex-col gap-4 p-1 pb-3 md:flex-row md:items-start md:overflow-x-auto"
  bind:this={scrollContainer}
>
  {#each columns as column (column.id)}
    {@const columnItems = items.filter((item) => itemColumn(item) === column.id)}
    <div
      class={cn(
        'flex w-full shrink-0 flex-col rounded-xl border p-3 md:w-96 xl:w-auto xl:min-w-80 xl:flex-1 xl:shrink',
        column.style.column,
        drag.overColumn === column.id && drag.draggedId && 'ring-2 ring-primary',
      )}
      data-column-id={column.id}
      ondragover={(e) => drag.dragOver(e, column.id)}
      ondragleave={(e) => drag.dragLeave(e)}
      ondrop={(e) => drag.drop(e, column.id)}
      role="region"
      aria-label={column.title}
    >
      <div class="flex items-center gap-2.5 px-1 pb-3">
        <span class={cn('size-2.5 shrink-0 rounded-full', column.style.dot)}></span>
        <h2 class="truncate text-base font-semibold">{column.title}</h2>
        <span
          class="ml-auto rounded-full bg-background/60 px-2 py-0.5 text-sm text-muted-foreground tabular-nums"
        >
          {columnItems.length}
        </span>
      </div>
      <div class="-m-1 flex min-h-20 flex-col gap-2.5 p-1">
        {#each columnItems as item (itemId(item))}
          {@const draggable = canDrag(item)}
          <div
            class={cn(
              'w-full rounded-lg border p-3.5 text-left text-base shadow-xs transition-colors select-none [-webkit-touch-callout:none] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
              column.style.card,
              draggable && hasMouse.current && 'cursor-grab active:cursor-grabbing',
              !draggable && 'cursor-pointer',
            )}
            draggable={draggable && hasMouse.current}
            ondragstart={(e) => drag.dragStart(e, itemId(item), column.id)}
            ondrag={(e) => drag.drag(e)}
            ondragend={() => drag.dragEnd()}
            {@attach draggable && !hasMouse.current ? drag.touch(itemId(item), column.id) : null}
            onclick={() => onOpen(item)}
            onkeydown={(e) => e.key === 'Enter' && onOpen(item)}
            role="button"
            tabindex="0"
          >
            {@render card(item)}
          </div>
        {:else}
          <p class="px-1 py-6 text-center text-sm text-muted-foreground">No requests</p>
        {/each}
      </div>
    </div>
  {/each}
</div>
