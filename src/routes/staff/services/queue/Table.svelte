<script lang="ts">
  import * as Table from '$lib/components/ui/table';
  import QueryState from '$lib/frontend/components/QueryState.svelte';
  import StatusBadge from '$lib/frontend/components/StatusBadge.svelte';
  import { formatDate } from '$lib/frontend/format';
  import { pollQuery } from '$lib/frontend/poll-query.svelte';
  import { PAYMENT_STATUS_DISPLAY } from '$lib/frontend/payment-status';
  import { getServiceRequests } from '$lib/remotes/endpoints/service.remote';
  import { formatCents } from '$lib/utils/billing';
  import { awaitingQuote } from '$lib/utils/services';
  import { openRequest } from './open-request';
  import { REQUEST_STATUS_DISPLAY } from './utils';

  const requestsQuery = getServiceRequests();
  pollQuery(() => requestsQuery);

  function handleRowKeydown(event: KeyboardEvent, requestId: string) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openRequest(requestId);
  }
</script>

<QueryState query={requestsQuery} label="service requests">
  {#snippet children(rows)}
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
          {#each rows as { request, serviceName, payment } (request.id)}
            {@const status = REQUEST_STATUS_DISPLAY[request.status]}
            {@const paymentDisplay = PAYMENT_STATUS_DISPLAY[payment.status]}
            <Table.Row
              class="cursor-pointer"
              tabindex={0}
              onclick={() => openRequest(request.id)}
              onkeydown={(e) => handleRowKeydown(e, request.id)}
            >
              <Table.Cell class="max-w-48">
                <div class="truncate font-medium">{serviceName}</div>
                <div class="truncate text-xs text-muted-foreground">
                  <span class="md:hidden">{request.customerName} ·</span>
                  {formatDate(request.submissionDate)}
                </div>
              </Table.Cell>
              <Table.Cell class="hidden max-w-48 truncate md:table-cell">
                {request.customerName}
              </Table.Cell>
              <Table.Cell>
                <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
              </Table.Cell>
              <Table.Cell class="hidden sm:table-cell">
                {#if awaitingQuote(payment)}
                  <StatusBadge tone="warning">Awaiting Quote</StatusBadge>
                {:else}
                  <StatusBadge tone={paymentDisplay.tone}>{paymentDisplay.label}</StatusBadge>
                {/if}
              </Table.Cell>
              <Table.Cell class="text-right tabular-nums">
                {#if awaitingQuote(payment)}
                  <span class="text-muted-foreground">—</span>
                {:else}
                  {formatCents(payment.total)}
                {/if}
              </Table.Cell>
            </Table.Row>
          {:else}
            <Table.Row>
              <Table.Cell colspan={5} class="h-20 text-center text-muted-foreground">
                No service requests yet.
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    </div>
  {/snippet}
</QueryState>
