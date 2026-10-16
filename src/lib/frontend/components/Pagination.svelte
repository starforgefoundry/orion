<script lang="ts">
  import * as Pagination from '$lib/components/ui/pagination';

  type Props = {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  };

  const { currentPage, totalPages, onPageChange }: Props = $props();
</script>

{#if totalPages > 1}
  <Pagination.Root
    count={totalPages}
    perPage={1}
    page={currentPage}
    {onPageChange}
    siblingCount={1}
    class="py-3"
  >
    {#snippet children({ pages, currentPage })}
      <Pagination.Content>
        <Pagination.Item>
          <Pagination.Previous />
        </Pagination.Item>
        {#each pages as page (page.key)}
          {#if page.type === 'ellipsis'}
            <Pagination.Item class="hidden sm:block">
              <Pagination.Ellipsis />
            </Pagination.Item>
          {:else}
            <Pagination.Item>
              <Pagination.Link {page} isActive={currentPage === page.value} />
            </Pagination.Item>
          {/if}
        {/each}
        <Pagination.Item>
          <Pagination.Next />
        </Pagination.Item>
      </Pagination.Content>
    {/snippet}
  </Pagination.Root>
{/if}
