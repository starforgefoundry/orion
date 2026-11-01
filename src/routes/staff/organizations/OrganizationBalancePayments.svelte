<script lang="ts">
  import * as Table from '$lib/components/ui/table';
  import IconButton from '$lib/frontend/components/IconButton.svelte';
  import StatusBadge from '$lib/frontend/components/StatusBadge.svelte';
  import { DATE_STYLE, formatDate } from '$lib/frontend/format';
  import { getPaymentStatusColor } from '$lib/frontend/payment-status';
  import { formatCents, PAYMENT_STATUS } from '$lib/utils/billing';
  import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
  import type { BalancePayment } from './organization-detail.svelte';

  const COLUMN_COUNT = 5;

  type Props = { payments: BalancePayment[] };

  let { payments }: Props = $props();

  function formatStatus(status: string): string {
    return status
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
</script>

<div class="overflow-hidden rounded-lg border">
  <Table.Root>
    <Table.Header class="bg-muted/50">
      <Table.Row>
        <Table.Head>Issued</Table.Head>
        <Table.Head class="hidden sm:table-cell">Paid</Table.Head>
        <Table.Head>Status</Table.Head>
        <Table.Head class="text-right">Amount</Table.Head>
        <Table.Head class="w-12"><span class="sr-only">Pay link</span></Table.Head>
      </Table.Row>
    </Table.Header>
    <Table.Body>
      {#each payments as payment (payment.id)}
        <Table.Row>
          <Table.Cell>
            {formatDate(payment.issuedDate, DATE_STYLE.SHORT)}
          </Table.Cell>
          <Table.Cell class="hidden sm:table-cell">
            {formatDate(payment.paymentDate, DATE_STYLE.SHORT)}
          </Table.Cell>
          <Table.Cell>
            <StatusBadge tone={getPaymentStatusColor(payment.status)}>
              {formatStatus(payment.status)}
            </StatusBadge>
          </Table.Cell>
          <Table.Cell class="text-right tabular-nums">
            {formatCents(payment.total)}
          </Table.Cell>
          <Table.Cell class="text-right">
            {#if payment.paymentUrl && payment.status === PAYMENT_STATUS.PENDING}
              <IconButton
                icon={ExternalLinkIcon}
                aria-label="Open payment link"
                href={payment.paymentUrl}
                target="_blank"
              />
            {/if}
          </Table.Cell>
        </Table.Row>
      {:else}
        <Table.Row>
          <Table.Cell colspan={COLUMN_COUNT} class="h-20 text-center text-muted-foreground">
            No balance payments found.
          </Table.Cell>
        </Table.Row>
      {/each}
    </Table.Body>
  </Table.Root>
</div>
