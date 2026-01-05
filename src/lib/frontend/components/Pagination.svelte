<script lang="ts">
  import { HStack, IconButton, Text } from '@immich/ui';
  import { mdiChevronLeft, mdiChevronRight } from '@mdi/js';

  type Props = {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  };

  const { currentPage, totalPages, onPageChange }: Props = $props();

  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages) {
      onPageChange(page);
    }
  }

  const pages = $derived(() => {
    const result: (number | string)[] = [];
    const maxVisible = 7; // Maximum number of page buttons to show

    if (totalPages <= maxVisible) {
      // Show all pages if total is less than max
      for (let i = 1; i <= totalPages; i++) {
        result.push(i);
      }
    } else {
      // Always show first page
      result.push(1);

      if (currentPage > 3) {
        result.push('...');
      }

      // Show pages around current page
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        result.push(i);
      }

      if (currentPage < totalPages - 2) {
        result.push('...');
      }

      // Always show last page
      result.push(totalPages);
    }

    return result;
  });
</script>

{#if totalPages > 1}
  <HStack class="items-center justify-center gap-2 py-4">
    <IconButton
      icon={mdiChevronLeft}
      size="medium"
      aria-label="Previous page"
      disabled={currentPage === 1}
      onclick={() => goToPage(currentPage - 1)}
    />

    {#each pages() as page}
      {#if page === '...'}
        <Text class="px-2 text-muted">...</Text>
      {:else}
        <button
          class="flex h-10 w-10 items-center justify-center rounded-md border transition-colors {page ===
          currentPage
            ? 'border-primary bg-primary text-white dark:text-black'
            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}"
          onclick={() => goToPage(page as number)}
        >
          {page}
        </button>
      {/if}
    {/each}

    <IconButton
      icon={mdiChevronRight}
      size="medium"
      aria-label="Next page"
      disabled={currentPage === totalPages}
      onclick={() => goToPage(currentPage + 1)}
    />
  </HStack>
{/if}
