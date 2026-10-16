<script lang="ts">
  import { goto } from '$app/navigation';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import { Spinner } from '$lib/components/ui/spinner';
  import { cn } from '$lib/frontend/cn';
  import IconButton from '$lib/frontend/components/IconButton.svelte';
  import StatusIndicator from '$lib/frontend/components/StatusIndicator.svelte';
  import { modalManager } from '$lib/frontend/modal-manager.svelte';
  import type { PrintRequestStatus } from '$lib/remotes/dtos/print_request.dto';
  import { getPrintRequests } from '$lib/remotes/endpoints/print_request.remote';
  import EllipsisVerticalIcon from '@lucide/svelte/icons/ellipsis-vertical';
  import MailIcon from '@lucide/svelte/icons/mail';
  import PackageCheckIcon from '@lucide/svelte/icons/package-check';
  import type { DateTime } from 'luxon';
  import { MediaQuery } from 'svelte/reactivity';
  import { KanbanDrag } from './kanban-drag.svelte';
  import RequestDetailModal from './RequestDetailModal.svelte';
  import {
    BOARD_STATUSES,
    changeStatus,
    sendPickupEmail,
    STATUS,
    STATUS_LABELS,
  } from './request-actions';
  import { PAYMENT_STATUS_DISPLAY } from './utils';

  type ColumnStyle = { dot: string; column: string; card: string };

  const COLUMN_STYLES: Record<(typeof BOARD_STATUSES)[number], ColumnStyle> = {
    in_queue: {
      dot: 'bg-muted-foreground',
      column: 'bg-muted/40',
      card: 'bg-card hover:border-foreground/25',
    },
    printing: {
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

  const columns = BOARD_STATUSES.map((id) => ({
    id,
    title: STATUS_LABELS[id],
    style: COLUMN_STYLES[id],
  }));

  const printRequests = getPrintRequests();
  const prints = $derived(
    (printRequests.current || []).filter((p) => p.payment?.status !== 'quote'),
  );

  // Touch devices use the long-press drag instead of native drag and drop.
  const hasMouse = new MediaQuery('pointer: fine');

  const drag = new KanbanDrag(async (requestId, column) => {
    const job = prints.find((print) => print.id === requestId);
    if (job) await changeStatus(job, column);
  });

  let scrollContainer = $state<HTMLElement>();
  $effect(() => drag.setScrollContainer(scrollContainer));

  function canDrag(job: (typeof prints)[number]) {
    return job.status !== STATUS.DONE;
  }

  function getColumnData(column: PrintRequestStatus) {
    return prints.filter((p) => p.status === column);
  }

  function openRequest(requestId: string) {
    goto(`?id=${requestId}`, { replaceState: true, noScroll: true, keepFocus: true });
    modalManager.show(RequestDetailModal, { requestId });
  }

  function formatDate(date: DateTime): string {
    return date.toLocaleString({ month: 'short', day: 'numeric', year: 'numeric' });
  }
</script>

{#snippet pickupMenu(job: (typeof prints)[number])}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="-my-1 -mr-1"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
  >
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <IconButton
            {...props}
            icon={EllipsisVerticalIcon}
            size="icon"
            aria-label="Request options"
            tooltip={false}
          />
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" class="w-56">
        <DropdownMenu.Item onSelect={() => sendPickupEmail(job.id)}>
          <MailIcon />
          Send Pickup Reminder
        </DropdownMenu.Item>
        <DropdownMenu.Item onSelect={() => changeStatus(job, STATUS.PICKED_UP)}>
          <PackageCheckIcon />
          Mark as Picked Up
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  </div>
{/snippet}

{#if printRequests.loading && !printRequests.current}
  <div class="flex justify-center py-8">
    <Spinner class="size-6" />
  </div>
{:else if printRequests.error}
  <p class="text-sm text-destructive">
    Error loading print requests: {printRequests.error.message}
  </p>
{:else}
  <div
    class="-m-1 flex flex-col gap-4 p-1 pb-3 md:flex-row md:items-start md:overflow-x-auto"
    bind:this={scrollContainer}
  >
    {#each columns as column (column.id)}
      {@const columnPrints = getColumnData(column.id)}
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
            {columnPrints.length}
          </span>
        </div>
        <div class="-m-1 flex min-h-20 flex-col gap-2.5 p-1">
          {#each columnPrints as job (job.id)}
            <div
              class={cn(
                'w-full rounded-lg border p-3.5 text-left text-base shadow-xs transition-colors select-none [-webkit-touch-callout:none] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                column.style.card,
                canDrag(job) && hasMouse.current && 'cursor-grab active:cursor-grabbing',
                !canDrag(job) && 'cursor-pointer',
              )}
              draggable={canDrag(job) && hasMouse.current}
              ondragstart={(e) => drag.dragStart(e, job.id, column.id)}
              ondrag={(e) => drag.drag(e)}
              ondragend={() => drag.dragEnd()}
              {@attach canDrag(job) && !hasMouse.current ? drag.touch(job.id, column.id) : null}
              onclick={() => openRequest(job.id)}
              onkeydown={(e) => e.key === 'Enter' && openRequest(job.id)}
              role="button"
              tabindex="0"
            >
              <div class="flex items-start gap-2">
                <div class="flex min-w-0 flex-1 flex-col gap-1">
                  <h3 class="truncate font-medium">{job.projectName}</h3>
                  <p class="truncate text-sm text-muted-foreground">
                    {job.customerName} · {formatDate(job.submissionDate)}
                  </p>
                  {#if job.payment}
                    <StatusIndicator
                      display={PAYMENT_STATUS_DISPLAY[job.payment.status]}
                      class="mt-1.5 self-start"
                    />
                  {/if}
                </div>
                {#if job.status === STATUS.DONE}
                  {@render pickupMenu(job)}
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
{/if}
