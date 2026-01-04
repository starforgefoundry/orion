<script lang="ts">
  import type { PrintRequestStatus } from '$lib/remotes/dtos/print_request.dto';
  import {
    getPrintRequests,
    updatePrintRequestStatus,
  } from '$lib/remotes/endpoints/print_request.remote';
  import { Heading, modalManager, toastManager } from '@immich/ui';
  import type { DateTime } from 'luxon';
  import RequestDetailModal from './RequestDetailModal.svelte';

  let printsRequest = getPrintRequests();
  let prints = $derived(printsRequest.current || []);

  let draggedJobId: string | null = $state(null);
  let draggedFromColumn: PrintRequestStatus | null = $state(null);
  let dragOverColumn: PrintRequestStatus | null = $state(null);
  let dragOverIndex = $state(-1);

  // Touch support
  let touchStartX = $state(0);
  let touchStartY = $state(0);
  let isDragging = $state(false);
  let draggedElement: HTMLElement | null = $state(null);

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

  function handleCardClick(requestId: string) {
    modalManager.open(RequestDetailModal, { requestId });
  }

  function formatDate(date: DateTime): string {
    return date.toLocaleString({
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function handleDragStart(event: DragEvent, jobId: string, column: PrintRequestStatus) {
    draggedJobId = jobId;
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
    current: typeof prints,
    jobId: string,
    targetColumn: PrintRequestStatus,
  ) {
    return current.map((p) => {
      if (p.id === jobId) {
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

    if (!draggedJobId) return;

    // keep a reference to the dragged item
    const jobId = draggedJobId;

    draggedJobId = null;
    draggedFromColumn = null;
    dragOverColumn = null;
    dragOverIndex = -1;

    try {
      // TODO: add check to confirm movement to Done column
      await updatePrintRequestStatus({ id: jobId, status: targetColumn }).updates(
        getPrintRequests().withOverride((current) =>
          optimisticUpdate(current, jobId, targetColumn),
        ),
      );
    } catch (error) {
      toastManager.danger('Failed to update print request status.');
    }
  }

  // Touch event handlers for mobile support
  function handleTouchStart(event: TouchEvent, jobId: string, column: PrintRequestStatus) {
    const touch = event.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    draggedJobId = jobId;
    draggedFromColumn = column;
    isDragging = false;
    draggedElement = event.currentTarget as HTMLElement;
  }

  function handleTouchMove(event: TouchEvent) {
    if (!draggedJobId || !draggedElement) return;

    const touch = event.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartX);
    const deltaY = Math.abs(touch.clientY - touchStartY);

    // Start dragging if moved more than 10px
    if (!isDragging && (deltaX > 10 || deltaY > 10)) {
      isDragging = true;
      event.preventDefault();
    }

    if (isDragging) {
      event.preventDefault();

      // Find element under touch point
      const elementAtPoint = document.elementFromPoint(touch.clientX, touch.clientY);
      if (elementAtPoint) {
        // Check if over a column container
        const columnContainer = elementAtPoint.closest('[data-column-id]');
        if (columnContainer) {
          const columnId = columnContainer.getAttribute('data-column-id') as PrintRequestStatus;
          dragOverColumn = columnId;

          // Check if over a card
          const card = elementAtPoint.closest('[data-card-index]');
          if (card) {
            dragOverIndex = parseInt(card.getAttribute('data-card-index') || '-1');
          } else {
            const columnData = getColumnData(columnId);
            dragOverIndex = columnData.length;
          }
        }
      }
    }
  }

  async function handleTouchEnd(event: TouchEvent, targetColumn?: PrintRequestStatus) {
    if (!isDragging || !draggedJobId) {
      // Reset everything
      draggedJobId = null;
      draggedFromColumn = null;
      dragOverColumn = null;
      dragOverIndex = -1;
      isDragging = false;
      draggedElement = null;
      return;
    }

    event.preventDefault();

    const touch = event.changedTouches[0];
    const elementAtPoint = document.elementFromPoint(touch.clientX, touch.clientY);

    let finalColumn = targetColumn;
    if (!finalColumn && elementAtPoint) {
      const columnContainer = elementAtPoint.closest('[data-column-id]');
      if (columnContainer) {
        finalColumn = columnContainer.getAttribute('data-column-id') as PrintRequestStatus;
      }
    }

    if (finalColumn && draggedJobId) {
      const jobId = draggedJobId;

      // Reset drag state
      draggedJobId = null;
      draggedFromColumn = null;
      dragOverColumn = null;
      dragOverIndex = -1;
      isDragging = false;
      draggedElement = null;

      try {
        await updatePrintRequestStatus({ id: jobId, status: finalColumn }).updates(
          getPrintRequests().withOverride((current) =>
            optimisticUpdate(current, jobId, finalColumn),
          ),
        );
      } catch (error) {
        toastManager.danger('Failed to update print request status.');
      }
    } else {
      // Reset drag state
      draggedJobId = null;
      draggedFromColumn = null;
      dragOverColumn = null;
      dragOverIndex = -1;
      isDragging = false;
      draggedElement = null;
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
      data-column-id={column.id}
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
      >
        {#each prints.filter((p) => p.status === column.id) as job, index}
          <div
            class="{column.cardClass} w-full cursor-grab rounded-md border-2 p-4 text-left transition-all duration-200 hover:border-blue-500 active:cursor-grabbing {isDragging &&
            draggedJobId === job.id
              ? 'opacity-50'
              : ''}"
            draggable="true"
            ondragstart={(e) => handleDragStart(e, job.id, column.id)}
            ondragover={(e) => handleDragOverCard(e, column.id, index)}
            ontouchstart={(e) => handleTouchStart(e, job.id, column.id)}
            ontouchmove={handleTouchMove}
            ontouchend={(e) => handleTouchEnd(e, column.id)}
            onclick={() => handleCardClick(job.id)}
            onkeydown={(e) => e.key === 'Enter' && handleCardClick(job.id)}
            role="button"
            tabindex="0"
            data-card-index={index}
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
