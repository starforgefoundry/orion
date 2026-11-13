<script lang="ts">
  import { cn } from '$lib/frontend/cn';
  import QueryState from '$lib/frontend/components/QueryState.svelte';
  import StatusBadge from '$lib/frontend/components/StatusBadge.svelte';
  import { formatDate } from '$lib/frontend/format';
  import {
    KanbanDrag,
    type KanbanColumn,
    type KanbanColumnStyle,
  } from '$lib/frontend/kanban-drag.svelte';
  import { PAYMENT_STATUS_DISPLAY } from '$lib/frontend/payment-status';
  import { getServiceRequests } from '$lib/remotes/endpoints/service.remote';
  import { formatCents } from '$lib/utils/billing';
  import { awaitingQuote } from '$lib/utils/services';
  import { MediaQuery } from 'svelte/reactivity';
  import { toast } from 'svelte-sonner';
  import { changeStatus } from './request-actions';
  import { openRequest } from './open-request';
  import { BOARD_STATUSES, quoteRequired, REQUEST_STATUS_DISPLAY, type BoardStatus } from './utils';

  const COLUMN_STYLES: Record<BoardStatus, KanbanColumnStyle> = {
    submitted: {
      dot: 'bg-muted-foreground',
      column: 'bg-muted/40',
      card: 'bg-card hover:border-foreground/25',
    },
    in_progress: {
      dot: 'bg-info',
      column: 'border-info/20 bg-info/5',
      card: 'border-info/20 bg-info/10 hover:border-info/50',
    },
    done: {
      dot: 'bg-success',
      column: 'border-success/20 bg-success/5',
      card: 'border-success/20 bg-success/10 hover:border-success/50',
    },
  };

  const columns: KanbanColumn<BoardStatus>[] = BOARD_STATUSES.map((id) => ({
    id,
    title: REQUEST_STATUS_DISPLAY[id].label,
    style: COLUMN_STYLES[id],
  }));

  const requestsQuery = getServiceRequests();
  const rows = $derived(requestsQuery.current ?? []);

  // Touch devices use the long-press drag instead of native drag and drop.
  const hasMouse = new MediaQuery('pointer: fine');

  const drag = new KanbanDrag(BOARD_STATUSES, async (requestId, column) => {
    const row = rows.find(({ request }) => request.id === requestId);
    if (!row) return;
    // Only sending a quote moves work forward, so take staff to the quote input instead.
    if (quoteRequired(row.payment, column)) {
      toast.info('Send a quote first', {
        description: 'Work can start once the customer has a quote.',
      });
      openRequest(requestId, true);
      return;
    }
    await changeStatus(row, column);
  });

  let scrollContainer = $state<HTMLElement>();
  $effect(() => drag.setScrollContainer(scrollContainer));
</script>

<QueryState query={requestsQuery} label="service requests">
  <div
    class="-m-1 flex flex-col gap-4 p-1 pb-3 md:flex-row md:items-start md:overflow-x-auto"
    bind:this={scrollContainer}
  >
    {#each columns as column (column.id)}
      {@const columnRows = rows.filter(({ request }) => request.status === column.id)}
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
            {columnRows.length}
          </span>
        </div>
        <div class="-m-1 flex min-h-20 flex-col gap-2.5 p-1">
          {#each columnRows as { request, serviceName, payment } (request.id)}
            {@const paymentDisplay = PAYMENT_STATUS_DISPLAY[payment.status]}
            <div
              class={cn(
                'flex w-full flex-col gap-1 rounded-lg border p-3.5 text-left text-base shadow-xs transition-colors select-none [-webkit-touch-callout:none] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                column.style.card,
                hasMouse.current && 'cursor-grab active:cursor-grabbing',
              )}
              draggable={hasMouse.current}
              ondragstart={(e) => drag.dragStart(e, request.id, column.id)}
              ondrag={(e) => drag.drag(e)}
              ondragend={() => drag.dragEnd()}
              {@attach !hasMouse.current ? drag.touch(request.id, column.id) : null}
              onclick={() => openRequest(request.id)}
              onkeydown={(e) => e.key === 'Enter' && openRequest(request.id)}
              role="button"
              tabindex="0"
            >
              <h3 class="truncate font-medium">{serviceName}</h3>
              <p class="truncate text-sm text-muted-foreground">
                {request.customerName} · {formatDate(request.submissionDate)}
              </p>
              <div class="mt-1.5 flex items-center gap-2">
                {#if awaitingQuote(payment)}
                  <StatusBadge tone="warning">Awaiting Quote</StatusBadge>
                {:else}
                  <StatusBadge tone={paymentDisplay.tone}>{paymentDisplay.label}</StatusBadge>
                  <span class="text-sm tabular-nums">{formatCents(payment.total)}</span>
                {/if}
              </div>
            </div>
          {:else}
            <p class="px-1 py-6 text-center text-sm text-muted-foreground">No requests</p>
          {/each}
        </div>
      </div>
    {/each}
  </div>
</QueryState>
