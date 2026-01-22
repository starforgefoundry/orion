<script lang="ts">
  import { goto } from '$app/navigation';
  import type { PrintRequestStatus } from '$lib/remotes/dtos/print_request.dto';
  import {
    getPrintRequests,
    sendPickupNotification,
    updatePrintRequestStatus,
  } from '$lib/remotes/endpoints/print_request.remote';
  import {
    Badge,
    ContextMenuButton,
    Heading,
    modalManager,
    toastManager,
    type MenuItems,
  } from '@immich/ui';
  import { mdiEmailOutline, mdiPackageVariantClosed } from '@mdi/js';
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
  let scrollContainer: HTMLElement | null = $state(null);
  let autoScrollInterval: number | null = $state(null);
  let dragOffsetX = $state(0);
  let dragOffsetY = $state(0);
  let dragClone: HTMLElement | null = $state(null);
  let initialCardRect: DOMRect | null = $state(null);

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
      title: 'Ready for Pickup',
      titleClass: 'bg-success-200',
      cardClass: 'bg-success-100 border-success-200 hover:border-success-300',
      columnClass: 'bg-success-50',
      hoverClass: 'ring-2 ring-success-300',
    },
  ];

  function handleCardClick(requestId: string) {
    goto(`?id=${requestId}`, { replaceState: true, noScroll: true, keepFocus: true });
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

  function handleDrag(event: DragEvent) {
    if (event.clientX > 0) {
      updateAutoScroll(event.clientX);
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

    if (!draggedJobId) {
      resetDragState();
      return;
    }

    // Use dragOverColumn if available, otherwise fall back to targetColumn
    const finalColumn = dragOverColumn || targetColumn;

    if (draggedFromColumn === finalColumn) {
      resetDragState();
      return;
    }

    // keep a reference to the dragged item
    const jobId = draggedJobId;
    const destinationColumn = finalColumn;

    resetDragState();

    try {
      // Confirm movement to Done column
      if (destinationColumn === 'done') {
        const confirmed = await modalManager.showDialog({
          title: 'Mark as Done',
          prompt: 'Are you sure this print request is complete and ready for pickup?',
          confirmText: 'Mark as Done',
          confirmColor: 'success',
          icon: mdiPackageVariantClosed,
        });

        if (!confirmed) {
          return;
        }
      }

      await updatePrintRequestStatus({ id: jobId, status: destinationColumn }).updates(
        getPrintRequests().withOverride((current) =>
          optimisticUpdate(current, jobId, destinationColumn),
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
    initialCardRect = draggedElement.getBoundingClientRect();
  }

  function handleTouchMove(event: TouchEvent) {
    if (!draggedJobId || !draggedElement) return;

    const touch = event.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartX);
    const deltaY = Math.abs(touch.clientY - touchStartY);

    // Start dragging if moved more than 10px in any direction
    if (!isDragging && (deltaX > 10 || deltaY > 10)) {
      isDragging = true;
      event.preventDefault();

      // Prevent body scrolling during drag
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';

      // Create a clone of the card for dragging
      if (!dragClone && initialCardRect) {
        dragClone = draggedElement.cloneNode(true) as HTMLElement;
        dragClone.style.position = 'fixed';
        dragClone.style.left = `${initialCardRect.left}px`;
        dragClone.style.top = `${initialCardRect.top}px`;
        dragClone.style.width = `${initialCardRect.width}px`;
        dragClone.style.height = `${initialCardRect.height}px`;
        dragClone.style.zIndex = '9999';
        dragClone.style.pointerEvents = 'none';
        dragClone.style.opacity = '0.9';
        dragClone.style.boxShadow = '0 10px 25px rgba(0,0,0,0.3)';
        dragClone.style.transform = 'rotate(2deg)';
        document.body.appendChild(dragClone);

        // Hide the original element
        draggedElement.style.opacity = '0.3';
      }

      startAutoScroll(touch.clientX);
    }

    if (isDragging && dragClone && initialCardRect) {
      event.preventDefault();

      // Update clone position
      dragOffsetX = touch.clientX - touchStartX;
      dragOffsetY = touch.clientY - touchStartY;
      dragClone.style.left = `${initialCardRect.left + dragOffsetX}px`;
      dragClone.style.top = `${initialCardRect.top + dragOffsetY}px`;

      // Update auto-scroll based on touch position
      updateAutoScroll(touch.clientX);

      // Find element under touch point (temporarily hide clone to get element below)
      dragClone.style.display = 'none';
      const elementAtPoint = document.elementFromPoint(touch.clientX, touch.clientY);
      dragClone.style.display = '';

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

  function startAutoScroll(clientX: number) {
    if (autoScrollInterval !== null) return;
    updateAutoScroll(clientX);
  }

  function updateAutoScroll(clientX: number) {
    if (!scrollContainer) return;

    const scrollZone = 100; // pixels from edge to trigger scroll
    const scrollSpeed = 10; // pixels per frame
    const containerRect = scrollContainer.getBoundingClientRect();

    // Clear existing interval
    if (autoScrollInterval !== null) {
      clearInterval(autoScrollInterval);
      autoScrollInterval = null;
    }

    // Check if near left edge
    if (clientX < containerRect.left + scrollZone) {
      autoScrollInterval = window.setInterval(() => {
        if (scrollContainer) {
          scrollContainer.scrollLeft -= scrollSpeed;
        }
      }, 16);
    }
    // Check if near right edge
    else if (clientX > containerRect.right - scrollZone) {
      autoScrollInterval = window.setInterval(() => {
        if (scrollContainer) {
          scrollContainer.scrollLeft += scrollSpeed;
        }
      }, 16);
    }
  }

  function stopAutoScroll() {
    if (autoScrollInterval !== null) {
      clearInterval(autoScrollInterval);
      autoScrollInterval = null;
    }
  }

  function resetDragState() {
    // Restore body scrolling
    document.body.style.overflow = '';
    document.body.style.touchAction = '';

    // Remove the drag clone if it exists
    if (dragClone) {
      dragClone.remove();
      dragClone = null;
    }
    // Restore original element opacity
    if (draggedElement) {
      draggedElement.style.opacity = '';
    }
    draggedJobId = null;
    draggedFromColumn = null;
    dragOverColumn = null;
    dragOverIndex = -1;
    isDragging = false;
    draggedElement = null;
    dragOffsetX = 0;
    dragOffsetY = 0;
    initialCardRect = null;
    stopAutoScroll();
  }

  async function handleTouchEnd(event: TouchEvent, targetColumn?: PrintRequestStatus) {
    if (!isDragging || !draggedJobId) {
      resetDragState();
      return;
    }

    event.preventDefault();

    // Use dragOverColumn which is tracked during touch move
    const finalColumn = dragOverColumn || targetColumn;

    console.log('drag Column:', draggedFromColumn);
    console.log('dragOver Column:', dragOverColumn);
    console.log('Final Column:', finalColumn);

    if (finalColumn && draggedJobId && draggedFromColumn !== finalColumn) {
      const jobId = draggedJobId;

      updatePrintRequestStatus({ id: jobId, status: finalColumn })
        .updates(
          getPrintRequests().withOverride((current) =>
            optimisticUpdate(current, jobId, finalColumn),
          ),
        )
        .catch(() => {
          toastManager.danger('Failed to update print request status.');
        });
    }

    resetDragState();
  }

  async function markPickedUp(jobId: string) {
    // Find the job and check payment status
    const job = prints.find((p) => p.id === jobId);
    if (!job) return;

    // Check if payment is paid
    if (job.payment && job.payment.status !== 'paid') {
      await modalManager.showDialog({
        title: 'Payment Required',
        prompt:
          'This print request cannot be marked as picked up because the payment has not been completed. Please ensure the payment is marked as paid before marking as picked up.',
        confirmText: 'OK',
        confirmColor: 'primary',
        icon: mdiPackageVariantClosed,
      });
      return;
    }

    try {
      await updatePrintRequestStatus({ id: jobId, status: 'picked_up' }).updates(
        getPrintRequests().withOverride((current) => optimisticUpdate(current, jobId, 'picked_up')),
      );
    } catch (error) {
      toastManager.danger('Failed to mark print request as picked up.');
    }
  }

  async function sendPickupEmail(jobId: string) {
    try {
      await sendPickupNotification(jobId);
      toastManager.success('Pickup notification sent successfully.');
    } catch (error) {
      toastManager.danger('Failed to send pickup notification.');
    }
  }

  const doneContextItems = (jobId: string): MenuItems => [
    {
      title: 'Send Pickup Reminder',
      icon: mdiEmailOutline,
      onAction: () => sendPickupEmail(jobId),
    },
    {
      title: 'Mark as Picked Up',
      icon: mdiPackageVariantClosed,
      onAction: () => markPickedUp(jobId),
    },
  ];
</script>

<div
  class="-mx-4 flex h-full gap-6 overflow-x-auto overscroll-x-contain px-4"
  bind:this={scrollContainer}
  style="touch-action: {isDragging ? 'none' : 'pan-x pan-y'};"
>
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
            class="{column.cardClass} w-full {job.status === 'done'
              ? 'cursor-pointer'
              : 'cursor-grab'} rounded-md border-2 p-4 text-left transition-all duration-200 hover:border-blue-500 {job.status !==
            'done'
              ? 'active:cursor-grabbing'
              : ''}"
            style="touch-action: {job.status !== 'done' ? 'none' : 'auto'};"
            draggable={job.status !== 'done'}
            ondragstart={(e) => job.status !== 'done' && handleDragStart(e, job.id, column.id)}
            ondrag={handleDrag}
            ondragover={(e) => handleDragOverCard(e, column.id, index)}
            ondragend={resetDragState}
            ontouchstart={(e) => job.status !== 'done' && handleTouchStart(e, job.id, column.id)}
            ontouchmove={handleTouchMove}
            ontouchend={(e) => handleTouchEnd(e, column.id)}
            onclick={() => handleCardClick(job.id)}
            onkeydown={(e) => e.key === 'Enter' && handleCardClick(job.id)}
            role="button"
            tabindex="0"
            data-card-index={index}
          >
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <h3 class="mb-2 text-lg font-semibold">{job.projectName}</h3>
                <p class="mb-1 text-sm">{job.customerName}</p>
                <p class="text-xs">{formatDate(job.submissionDate)}</p>
                {#if job.payment}
                  <div class="mt-2">
                    {#if job.payment.status === 'quote'}
                      <Badge color="secondary" size="small">Awaiting Quote</Badge>
                    {:else if job.payment.status === 'pending'}
                      <Badge color="info" size="small">Pending Payment</Badge>
                    {:else if job.payment.status === 'paid'}
                      <Badge color="success" size="small">Paid</Badge>
                    {/if}
                  </div>
                {/if}
              </div>
              {#if job.status === 'done'}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <div class="flex gap-2" onclick={(e) => e.stopPropagation()}>
                  <ContextMenuButton position="top-right" items={doneContextItems(job.id)} />
                </div>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/each}
</div>
