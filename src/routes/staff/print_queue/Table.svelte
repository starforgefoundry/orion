<script lang="ts">
  import { goto } from '$app/navigation';
  import Pagination from '$lib/frontend/components/Pagination.svelte';
  import {
    Table,
    TableBody,
    TableCell,
    TableHeader,
    TableHeaderCell,
    TableRow,
  } from '$lib/frontend/components/table';
  import { searchPrintRequests } from '$lib/remotes/endpoints/print_request.remote';
  import { Badge, Input, modalManager } from '@immich/ui';
  import { mdiMagnify } from '@mdi/js';
  import RequestDetailModal from './RequestDetailModal.svelte';
  import { getPaymentStatusColor, getStatusColor } from './utils';

  let searchField = $state('');
  let searchState = $state('');
  let page = $state(1);
  let printsRequest = $derived(
    searchPrintRequests({
      query: searchState,
      page: page,
    }),
  );

  let prints = $derived(printsRequest.current?.data || []);
  let pagination = $derived(printsRequest.current?.pagination);
  $inspect(pagination);

  function handleRowClick(requestId: string) {
    goto(`?id=${requestId}`, { replaceState: true, noScroll: true, keepFocus: true });
    modalManager.open(RequestDetailModal, { requestId });
  }

  function formatPrice(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
  }

  function formatStatus(status: string): string {
    return status
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  function search() {
    searchState = searchField;
    page = 1;
  }

  function handlePageChange(newPage: number) {
    page = newPage;
  }
</script>

<Input
  placeholder="Search Print Requests"
  class=" w-1/3 self-end"
  bind:value={searchField}
  leadingIcon={mdiMagnify}
  onkeydown={(e) => e.key === 'Enter' && search()}
  onblur={search}
/>

<Table>
  <TableHeader>
    <TableHeaderCell width="w-3/12" align="left" class="px-4">Request Name</TableHeaderCell>
    <TableHeaderCell width="w-3/12" align="left" class="px-4">Customer Name</TableHeaderCell>
    <TableHeaderCell width="w-2/12">Request Status</TableHeaderCell>
    <TableHeaderCell width="w-2/12">Payment Status</TableHeaderCell>
    <TableHeaderCell width="w-2/12">Price</TableHeaderCell>
  </TableHeader>

  <TableBody>
    {#each prints as print}
      <TableRow hoverable clickable onclick={() => handleRowClick(print.id)}>
        <TableCell width="w-3/12" align="left" class="px-4">{print.projectName}</TableCell>
        <TableCell width="w-3/12" align="left" class="px-4">{print.customerName}</TableCell>
        <TableCell width="w-2/12">
          <div class="px-2 py-1">
            <Badge color={getStatusColor(print.status)}>{formatStatus(print.status)}</Badge>
          </div>
        </TableCell>
        <TableCell width="w-2/12">
          <div class="px-2 py-1">
            {#if print.payment}
              <Badge color={getPaymentStatusColor(print.payment.status)}
                >{formatStatus(print.payment.status)}</Badge
              >
            {:else}
              <span class="text-muted">—</span>
            {/if}
          </div>
        </TableCell>
        <TableCell width="w-2/12">
          {#if print.payment?.total}
            {formatPrice(print.payment.total)}
          {:else}
            <span class="text-muted">—</span>
          {/if}
        </TableCell>
      </TableRow>
    {/each}
  </TableBody>
</Table>

{#if pagination}
  <Pagination
    currentPage={pagination.page}
    totalPages={pagination.totalPages}
    onPageChange={handlePageChange}
  />
{/if}
