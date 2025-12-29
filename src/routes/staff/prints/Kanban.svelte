<script lang="ts">
  import { Heading } from '@immich/ui';

  interface PrintJob {
    id: string;
    title: string;
    submittedBy: string;
    submittedDate: Date;
  }

  // Sample data - replace with your actual data
  let readyToPrint: PrintJob[] = $state([
    {
      id: '1',
      title: 'Prototype Housing',
      submittedBy: 'John Doe',
      submittedDate: new Date('2025-12-28'),
    },
    {
      id: '2',
      title: 'Gear Assembly',
      submittedBy: 'Jane Smith',
      submittedDate: new Date('2025-12-27'),
    },
  ]);

  let printing: PrintJob[] = $state([
    {
      id: '3',
      title: 'Custom Bracket',
      submittedBy: 'Bob Johnson',
      submittedDate: new Date('2025-12-26'),
    },
  ]);

  let done: PrintJob[] = $state([
    {
      id: '4',
      title: 'Test Part',
      submittedBy: 'Alice Williams',
      submittedDate: new Date('2025-12-25'),
    },
  ]);

  let draggedItem: PrintJob | null = $state(null);
  let draggedFromColumn: 'readyToPrint' | 'printing' | 'done' | null = $state(null);
  let dragOverColumn: 'readyToPrint' | 'printing' | 'done' | null = $state(null);
  let dragOverIndex = $state(-1);

  const columns = [
    { id: 'readyToPrint' as const, title: 'Ready to Print' },
    { id: 'printing' as const, title: 'Printing' },
    { id: 'done' as const, title: 'Done' },
  ];

  function getColumnData(columnId: 'readyToPrint' | 'printing' | 'done'): PrintJob[] {
    return columnId === 'readyToPrint' ? readyToPrint : columnId === 'printing' ? printing : done;
  }

  function handleCardClick(id: string) {
    console.log('Clicked card ID:', id);
    // You can implement your logic here
  }

  function formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function handleDragStart(
    event: DragEvent,
    job: PrintJob,
    column: 'readyToPrint' | 'printing' | 'done',
  ) {
    draggedItem = job;
    draggedFromColumn = column;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  function handleDragOverCard(
    event: DragEvent,
    column: 'readyToPrint' | 'printing' | 'done',
    index: number,
  ) {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    dragOverColumn = column;
    dragOverIndex = index;
  }

  function handleDragOverContainer(event: DragEvent, column: 'readyToPrint' | 'printing' | 'done') {
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

  function handleDrop(event: DragEvent, targetColumn: 'readyToPrint' | 'printing' | 'done') {
    event.preventDefault();

    if (!draggedItem || !draggedFromColumn) {
      return;
    }

    let targetIndex = dragOverIndex;

    // Remove from source column
    if (draggedFromColumn === 'readyToPrint') {
      readyToPrint = readyToPrint.filter((job) => job.id !== draggedItem!.id);
    } else if (draggedFromColumn === 'printing') {
      printing = printing.filter((job) => job.id !== draggedItem!.id);
    } else if (draggedFromColumn === 'done') {
      done = done.filter((job) => job.id !== draggedItem!.id);
    }

    // Adjust index if moving within same column
    if (draggedFromColumn === targetColumn) {
      const sourceData =
        draggedFromColumn === 'readyToPrint'
          ? readyToPrint
          : draggedFromColumn === 'printing'
            ? printing
            : done;
      const sourceIndex = sourceData.findIndex((job) => job.id === draggedItem!.id);
      if (sourceIndex !== -1 && sourceIndex < targetIndex) {
        targetIndex--;
      }
    }

    // Insert at target position
    if (targetColumn === 'readyToPrint') {
      readyToPrint.splice(targetIndex, 0, draggedItem);
      readyToPrint = readyToPrint;
    } else if (targetColumn === 'printing') {
      printing.splice(targetIndex, 0, draggedItem);
      printing = printing;
    } else if (targetColumn === 'done') {
      done.splice(targetIndex, 0, draggedItem);
      done = done;
    }

    draggedItem = null;
    draggedFromColumn = null;
    dragOverColumn = null;
    dragOverIndex = -1;
  }
</script>

<div class="-mx-4 flex h-full gap-6 overflow-x-auto px-4">
  {#each columns as column}
    <div class="bg-level-1 flex min-w-75 flex-1 flex-col rounded-lg p-4">
      <Heading class="mb-2">{column.title}</Heading>
      <div
        class="flex min-h-25 flex-1 flex-col gap-4 overflow-y-auto pt-2"
        ondragover={(e) => handleDragOverContainer(e, column.id)}
        ondragleave={handleDragLeave}
        ondrop={(e) => handleDrop(e, column.id)}
        role="region"
        aria-label="{column.title} column"
      >
        {#each getColumnData(column.id) as job, index}
          {#if dragOverColumn === column.id && dragOverIndex === index}
            <div class="-my-2 h-0.75 rounded-sm bg-blue-500"></div>
          {/if}
          <div
            class="bg-level-2 w-full cursor-grab rounded-md border border-gray-500 p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-500 hover:shadow-md active:cursor-grabbing"
            draggable="true"
            ondragstart={(e) => handleDragStart(e, job, column.id)}
            ondragover={(e) => handleDragOverCard(e, column.id, index)}
            onclick={() => handleCardClick(job.id)}
            onkeydown={(e) => e.key === 'Enter' && handleCardClick(job.id)}
            role="button"
            tabindex="0"
          >
            <h3 class="mb-2 text-lg font-semibold">{job.title}</h3>
            <p class="mb-1 text-sm">Submitted by: {job.submittedBy}</p>
            <p class="text-xs">{formatDate(job.submittedDate)}</p>
          </div>
        {/each}
        {#if dragOverColumn === column.id && dragOverIndex === getColumnData(column.id).length}
          <div class="-my-2 h-0.75 rounded-sm bg-blue-500"></div>
        {/if}
      </div>
    </div>
  {/each}
</div>
