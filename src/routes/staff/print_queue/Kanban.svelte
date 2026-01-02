<script lang="ts">
  import type { PrintRequestDto, PrintRequestStatus } from '$lib/remotes/dtos/print_request.dto';
  import {
    getPrintRequests,
    updatePrintRequest,
  } from '$lib/remotes/endpoints/print_request.remote';
  import { Heading, modalManager, toastManager } from '@immich/ui';
  import type { DateTime } from 'luxon';
  import RequestDetailModal from './RequestDetailModal.svelte';

  let printsRequest = getPrintRequests();
  let prints = $derived(printsRequest.current || []);

  let draggedItem: PrintRequestDto | null = $state(null);
  let draggedFromColumn: PrintRequestStatus | null = $state(null);
  let dragOverColumn: PrintRequestStatus | null = $state(null);
  let dragOverIndex = $state(-1);

  const columns = [
    {
      id: 'in_queue' as const,
      title: 'Print Queue',
      titleClass: 'bg-level-3',
      cardClass: 'bg-level-2 border-slate-600 hover:border-slate-500',
      columnClass: 'bg-level-1',
      hoverClass: 'ring-2 ring-slate-500',
    },
    {
      id: 'printing' as const,
      title: 'Printing',
      titleClass: 'bg-info-200',
      cardClass: 'bg-info-100 border-info-200 hover:border-info-300',
      columnClass: 'bg-info-50',
      hoverClass: 'ring-2 ring-info-300',
    },
    {
      id: 'done' as const,
      title: 'Done',
      titleClass: 'bg-success-200',
      cardClass: 'bg-success-100 border-success-200 hover:border-success-300',
      columnClass: 'bg-success-50',
      hoverClass: 'ring-2 ring-success-300',
    },
  ];

  function handleCardClick(request: PrintRequestDto) {
    modalManager.open(RequestDetailModal, { request: request });
  }

  function formatDate(date: DateTime): string {
    return date.toLocaleString({
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function handleDragStart(event: DragEvent, job: PrintRequestDto, column: PrintRequestStatus) {
    draggedItem = job;
    draggedFromColumn = column;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  function handleDragOverCard(event: DragEvent, column: PrintRequestStatus, index: number) {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    dragOverColumn = column;
    dragOverIndex = index;
  }

  function getColumnData(column: PrintRequestStatus) {
    return prints.filter((p) => p.status === column);
  }

  function optimisticUpdate(
    current: PrintRequestDto[],
    item: PrintRequestDto,
    targetColumn: PrintRequestStatus,
  ) {
    return current.map((p) => {
      if (p.id === item.id) {
        return { ...p, status: targetColumn };
      }
      return p;
    });
  }

  function handleDragOverContainer(event: DragEvent, column: PrintRequestStatus) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    dragOverColumn = column;
    // Set to end of list
    const columnData = getColumnData(column);
    dragOverIndex = columnData.length;
  }

  function handleDragLeave() {
    dragOverColumn = null;
    dragOverIndex = -1;
  }

  async function handleDrop(event: DragEvent, targetColumn: PrintRequestStatus) {
    event.preventDefault();

    if (!draggedItem) return;

    // keep a reference to the dragged item
    const item = draggedItem;

    draggedItem = null;
    draggedFromColumn = null;
    dragOverColumn = null;
    dragOverIndex = -1;

    try {
      await updatePrintRequest({ id: item.id, status: targetColumn }).updates(
        getPrintRequests().withOverride((current) => optimisticUpdate(current, item, targetColumn)),
      );
    } catch (error) {
      toastManager.danger('Failed to update print request status.');
    }
  }
</script>

<div class="-mx-4 flex h-full gap-6 overflow-x-auto px-4">
  {#each columns as column}
    <div
      class="my-1 flex min-w-75 flex-1 flex-col rounded-lg p-4 {column.columnClass} {dragOverColumn ===
      column.id
        ? column.hoverClass
        : ''}"
    >
      <Heading size="small" class="mb-2 inline-block w-fit rounded-xl p-2 px-4 {column.titleClass}">
        {column.title}
      </Heading>
      <div
        class="flex min-h-25 flex-1 flex-col gap-4 overflow-y-auto pt-2"
        ondragover={(e) => handleDragOverContainer(e, column.id)}
        ondragleave={handleDragLeave}
        ondrop={(e) => handleDrop(e, column.id)}
        role="region"
        aria-label="{column.title} column"
      >
        {#each prints.filter((p) => p.status === column.id) as job, index}
          <div
            class="{column.cardClass} w-full cursor-grab rounded-md border-2 p-4 text-left transition-all duration-200 hover:border-blue-500 active:cursor-grabbing"
            draggable="true"
            ondragstart={(e) => handleDragStart(e, job, column.id)}
            ondragover={(e) => handleDragOverCard(e, column.id, index)}
            onclick={() => handleCardClick(job)}
            onkeydown={(e) => e.key === 'Enter' && handleCardClick(job)}
            role="button"
            tabindex="0"
          >
            <h3 class="mb-2 text-lg font-semibold">{job.projectName}</h3>
            <p class="mb-1 text-sm">{job.customerName}</p>
            <p class="text-xs">{formatDate(job.submissionDate)}</p>
          </div>
        {/each}
      </div>
    </div>
  {/each}
</div>
