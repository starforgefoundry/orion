<script lang="ts">
  import {
    Table,
    TableBody,
    TableCell,
    TableHeader,
    TableHeaderCell,
    TableRow,
  } from '$lib/frontend/components/table';
  import { searchWaivers } from '$lib/remotes/endpoints/waiver.remote';
  import { Heading, IconButton, Input, LoadingSpinner } from '@immich/ui';
  import { mdiChevronLeft, mdiChevronRight, mdiEye, mdiMagnify } from '@mdi/js';

  let searchTerm = $state('');
  let page = $state(1);
  const pageSize = 25;

  let waivers = $state(searchWaivers({ query: '', page: 1, pageSize }));

  let debounceTimer: ReturnType<typeof setTimeout>;
  function handleSearch(value: string) {
    searchTerm = value;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      page = 1;
      waivers = searchWaivers({ query: searchTerm, page: 1, pageSize });
    }, 300);
  }

  function handlePrevPage() {
    if (page > 1) {
      page--;
      waivers = searchWaivers({ query: searchTerm, page, pageSize });
    }
  }

  function handleNextPage() {
    if (waivers.current && page < waivers.current.pagination.totalPages) {
      page++;
      waivers = searchWaivers({ query: searchTerm, page, pageSize });
    }
  }

  function formatDate(date: unknown) {
    if (!date) return '';
    if (typeof date === 'object' && 'toLocaleString' in date) {
      return (date as { toLocaleString: (opts: object) => string }).toLocaleString({
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
    const d = new Date(String(date));
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function viewWaiver(waiverId: string) {
    window.open(`/staff/waivers/view/${waiverId}`, '_blank');
  }
</script>

<div class="mb-6 flex items-center justify-between">
  <Heading size="large" class="inline-block w-fit">Signed Waivers</Heading>
  <div class="flex w-1/2 items-center gap-2">
    <Input
      placeholder="Search waivers..."
      leadingIcon={mdiMagnify}
      value={searchTerm}
      oninput={(e) => handleSearch(e.currentTarget.value)}
    />
  </div>
</div>

{#if waivers.loading}
  <div class="flex justify-center">
    <LoadingSpinner size="large" />
  </div>
{:else if waivers.error}
  <p class="text-danger">Error loading waivers: {waivers.error.message}</p>
{:else if waivers.current}
  <Table>
    <TableHeader>
      <TableHeaderCell width="w-3/12" align="left">Name</TableHeaderCell>
      <TableHeaderCell width="w-4/12" align="left">Email</TableHeaderCell>
      <TableHeaderCell width="w-3/12" align="left">Signed Date</TableHeaderCell>
      <TableHeaderCell width="w-2/12">Actions</TableHeaderCell>
    </TableHeader>
    <TableBody>
      {#each waivers.current.data as waiver}
        <TableRow>
          <TableCell width="w-3/12" align="left">{waiver.name}</TableCell>
          <TableCell width="w-4/12" align="left">{waiver.email}</TableCell>
          <TableCell width="w-3/12" align="left">{formatDate(waiver.signedDate)}</TableCell>
          <TableCell width="w-2/12" class="flex justify-center gap-2">
            <IconButton
              icon={mdiEye}
              aria-label="View Waiver"
              onclick={() => viewWaiver(waiver.id)}
            />
          </TableCell>
        </TableRow>
      {/each}

      {#if waivers.current.data.length === 0}
        <TableRow>
          <TableCell width="w-full" class="text-center">No waivers found.</TableCell>
        </TableRow>
      {/if}
    </TableBody>
  </Table>

  {#if waivers.current.pagination.totalPages > 1}
    <div class="mt-4 flex items-center justify-center gap-4">
      <IconButton
        icon={mdiChevronLeft}
        aria-label="Previous page"
        disabled={page <= 1}
        onclick={handlePrevPage}
      />
      <span class="text-sm">
        Page {waivers.current.pagination.page} of {waivers.current.pagination.totalPages}
      </span>
      <IconButton
        icon={mdiChevronRight}
        aria-label="Next page"
        disabled={page >= waivers.current.pagination.totalPages}
        onclick={handleNextPage}
      />
    </div>
  {/if}
{/if}
