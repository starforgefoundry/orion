<script lang="ts">
  import QueryState from '$lib/frontend/components/QueryState.svelte';
  import StatusBadge from '$lib/frontend/components/StatusBadge.svelte';
  import WorkOrderBoard, {
    BOARD_COLUMN_STYLE,
  } from '$lib/frontend/components/WorkOrderBoard.svelte';
  import WorkOrderCardMenu from '$lib/frontend/components/WorkOrderCardMenu.svelte';
  import { formatDate } from '$lib/frontend/format';
  import { PAYMENT_STATUS_DISPLAY } from '$lib/frontend/payment-status';
  import { getServiceRequests } from '$lib/remotes/endpoints/service.remote';
  import { formatCents } from '$lib/utils/billing';
  import { awaitingQuote, quoteRequired } from '$lib/utils/services';
  import MailIcon from '@lucide/svelte/icons/mail';
  import PackageCheckIcon from '@lucide/svelte/icons/package-check';
  import { toast } from 'svelte-sonner';
  import { changeStatus, sendReadyEmail, type ServiceRequestRow } from './request-actions';
  import { openRequest } from './open-request';
  import { REQUEST_STATUS_DISPLAY, STATUS, type BoardStatus } from './utils';

  const columns = [
    {
      id: STATUS.SUBMITTED,
      title: REQUEST_STATUS_DISPLAY.submitted.label,
      style: BOARD_COLUMN_STYLE.WAITING,
    },
    {
      id: STATUS.IN_PROGRESS,
      title: REQUEST_STATUS_DISPLAY.in_progress.label,
      style: BOARD_COLUMN_STYLE.WORKING,
    },
    {
      id: STATUS.DONE,
      title: REQUEST_STATUS_DISPLAY.done.label,
      style: BOARD_COLUMN_STYLE.FINISHED,
    },
  ];

  const requestsQuery = getServiceRequests();

  async function moveRequest(row: ServiceRequestRow, column: BoardStatus) {
    // Only sending a quote moves work forward, so take staff to the quote input instead.
    if (quoteRequired(row.payment, column)) {
      toast.info('Send a quote first', {
        description: 'Work can start once the customer has a quote.',
      });
      openRequest(row.request.id, true);
      return;
    }
    await changeStatus(row, column);
  }
</script>

<QueryState query={requestsQuery} label="service requests">
  {#snippet children(rows)}
    <WorkOrderBoard
      {columns}
      items={rows}
      query={requestsQuery}
      itemId={(row) => row.request.id}
      itemColumn={(row) => row.request.status}
      onMove={moveRequest}
      onOpen={(row) => openRequest(row.request.id)}
    >
      {#snippet card(row)}
        {@const paymentDisplay = PAYMENT_STATUS_DISPLAY[row.payment.status]}
        <div class="flex items-start gap-2">
          <div class="flex min-w-0 flex-1 flex-col gap-1">
            <h3 class="truncate font-medium">{row.serviceName}</h3>
            <p class="truncate text-sm text-muted-foreground">
              {row.request.customerName} · {formatDate(row.request.submissionDate)}
            </p>
            <div class="mt-1.5 flex items-center gap-2">
              {#if awaitingQuote(row.payment)}
                <StatusBadge tone="warning">Awaiting Quote</StatusBadge>
              {:else}
                <StatusBadge tone={paymentDisplay.tone}>{paymentDisplay.label}</StatusBadge>
                <span class="text-sm tabular-nums">{formatCents(row.payment.total)}</span>
              {/if}
            </div>
          </div>
          {#if row.request.status === STATUS.DONE}
            <WorkOrderCardMenu
              actions={[
                {
                  label: 'Send Pickup Reminder',
                  icon: MailIcon,
                  onSelect: () => sendReadyEmail(row),
                },
                {
                  label: 'Mark as Picked Up',
                  icon: PackageCheckIcon,
                  onSelect: () => changeStatus(row, STATUS.PICKED_UP),
                },
              ]}
            />
          {/if}
        </div>
      {/snippet}
    </WorkOrderBoard>
  {/snippet}
</QueryState>
