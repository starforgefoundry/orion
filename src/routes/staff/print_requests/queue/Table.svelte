<script lang="ts">
  import { goto } from '$app/navigation';
  import * as Table from '$lib/components/ui/table';
  import Pagination from '$lib/frontend/components/Pagination.svelte';
  import StatusIndicator from '$lib/frontend/components/StatusIndicator.svelte';
  import TextInput from '$lib/frontend/components/form/TextInput.svelte';
  import { modalManager } from '$lib/frontend/modal-manager.svelte';
  import { pollQuery } from '$lib/frontend/poll-query.svelte';
  import { searchPrintRequests } from '$lib/remotes/endpoints/print_request.remote';
  import SearchIcon from '@lucide/svelte/icons/search';
  import RequestDetailModal from './RequestDetailModal.svelte';
  import { formatPrice, PAYMENT_STATUS_DISPLAY, REQUEST_STATUS_DISPLAY } from './utils';

  let searchField = $state('');
  let searchState = $state('');
  let page = $state(1);
  let printsRequest = $derived(searchPrintRequests({ query: searchState, page }));

  let prints = $derived(printsRequest.current?.data || []);
  let pagination = $derived(printsRequest.current?.pagination);

  pollQuery(() => printsRequest);

  function openRequest(requestId: string) {
    goto(`?id=${requestId}`, { replaceState: true, noScroll: true, keepFocus: true });
    modalManager.show(RequestDetailModal, { requestId });
  }

  function handleRowKeydown(event: KeyboardEvent, requestId: string) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openRequest(requestId);
  }

  function search() {
    searchState = searchField;
    page = 1;
  }
</script>

<TextInput
  icon={SearchIcon}
  placeholder="Search print requests"
  class="mb-3 sm:max-w-xs"
  bind:value={searchField}
  onkeydown={(e) => e.key === 'Enter' && search()}
  onblur={search}
/>

<div class="overflow-hidden rounded-lg border">
  <Table.Root>
    <Table.Header class="bg-muted/50">
      <Table.Row>
        <Table.Head>Request</Table.Head>
        <Table.Head class="hidden md:table-cell">Customer</Table.Head>
        <Table.Head>Status</Table.Head>
        <Table.Head class="hidden sm:table-cell">Payment</Table.Head>
        <Table.Head class="text-right">Price</Table.Head>
      </Table.Row>
    </Table.Header>
    <Table.Body>
      {#each prints as print (print.id)}
        <Table.Row
          class="cursor-pointer"
          tabindex={0}
          onclick={() => openRequest(print.id)}
          onkeydown={(e) => handleRowKeydown(e, print.id)}
        >
          <Table.Cell class="max-w-48">
            <div class="truncate font-medium">{print.projectName}</div>
            <div class="truncate text-xs text-muted-foreground md:hidden">
              {print.customerName}
            </div>
          </Table.Cell>
          <Table.Cell class="hidden max-w-48 truncate md:table-cell"
            >{print.customerName}</Table.Cell
          >
          <Table.Cell>
            <StatusIndicator display={REQUEST_STATUS_DISPLAY[print.status]} />
          </Table.Cell>
          <Table.Cell class="hidden sm:table-cell">
            {#if print.payment}
              <StatusIndicator display={PAYMENT_STATUS_DISPLAY[print.payment.status]} />
            {:else}
              <span class="text-muted-foreground">—</span>
            {/if}
          </Table.Cell>
          <Table.Cell class="text-right tabular-nums">
            {#if print.payment?.total}
              {formatPrice(print.payment.total)}
            {:else}
              <span class="text-muted-foreground">—</span>
            {/if}
          </Table.Cell>
        </Table.Row>
      {:else}
        <Table.Row>
          <Table.Cell colspan={5} class="h-20 text-center text-muted-foreground">
            No print requests found.
          </Table.Cell>
        </Table.Row>
      {/each}
    </Table.Body>
  </Table.Root>
</div>

{#if pagination}
  <Pagination
    currentPage={pagination.page}
    totalPages={pagination.totalPages}
    onPageChange={(newPage) => (page = newPage)}
  />
{/if}
