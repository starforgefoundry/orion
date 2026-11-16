<script lang="ts">
  import QueryState from '$lib/frontend/components/QueryState.svelte';
  import WorkOrderBoard, {
    BOARD_COLUMN_STYLE,
  } from '$lib/frontend/components/WorkOrderBoard.svelte';
  import WorkOrderCardMenu from '$lib/frontend/components/WorkOrderCardMenu.svelte';
  import { formatDate } from '$lib/frontend/format';
  import { PAYMENT_STATUS_DISPLAY } from '$lib/frontend/payment-status';
  import { getPrintRequests } from '$lib/remotes/endpoints/print-request.remote';
  import { PAYMENT_STATUS } from '$lib/utils/billing';
  import MailIcon from '@lucide/svelte/icons/mail';
  import PackageCheckIcon from '@lucide/svelte/icons/package-check';
  import { openRequest } from './open-request';
  import StatusIndicator from './StatusIndicator.svelte';
  import { changeStatus, sendPickupEmail, STATUS, STATUS_LABELS } from './request-actions';

  const columns = [
    { id: STATUS.IN_QUEUE, title: STATUS_LABELS.in_queue, style: BOARD_COLUMN_STYLE.WAITING },
    { id: STATUS.PRINTING, title: STATUS_LABELS.printing, style: BOARD_COLUMN_STYLE.WORKING },
    { id: STATUS.DONE, title: STATUS_LABELS.done, style: BOARD_COLUMN_STYLE.FINISHED },
  ];

  const printRequests = getPrintRequests();
  // Quotes wait on the customer, so they stay off the board until approved.
  const prints = $derived(
    (printRequests.current ?? []).filter((p) => p.payment?.status !== PAYMENT_STATUS.QUOTE),
  );
</script>

<QueryState query={printRequests} label="print requests">
  <WorkOrderBoard
    {columns}
    items={prints}
    query={printRequests}
    itemId={(job) => job.id}
    itemColumn={(job) => job.status}
    canDrag={(job) => job.status !== STATUS.DONE}
    onMove={(job, column) => changeStatus(job, column)}
    onOpen={(job) => openRequest(job.id)}
  >
    {#snippet card(job)}
      <div class="flex items-start gap-2">
        <div class="flex min-w-0 flex-1 flex-col gap-1">
          <h3 class="truncate font-medium">{job.projectName}</h3>
          <p class="truncate text-sm text-muted-foreground">
            {job.customerName} · {formatDate(job.submissionDate)}
          </p>
          {#if job.payment}
            <StatusIndicator
              display={PAYMENT_STATUS_DISPLAY[job.payment.status]}
              class="mt-1.5 self-start"
            />
          {/if}
        </div>
        {#if job.status === STATUS.DONE}
          <WorkOrderCardMenu
            actions={[
              {
                label: 'Send Pickup Reminder',
                icon: MailIcon,
                onSelect: () => sendPickupEmail(job.id),
              },
              {
                label: 'Mark as Picked Up',
                icon: PackageCheckIcon,
                onSelect: () => changeStatus(job, STATUS.PICKED_UP),
              },
            ]}
          />
        {/if}
      </div>
    {/snippet}
  </WorkOrderBoard>
</QueryState>
