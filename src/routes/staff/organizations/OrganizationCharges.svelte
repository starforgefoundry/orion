<script lang="ts">
  import * as Table from '$lib/components/ui/table';
  import Pagination from '$lib/frontend/components/Pagination.svelte';
  import { DATE_STYLE, formatIsoDate } from '$lib/frontend/format';
  import { formatCents } from '$lib/utils/billing';
  import type { OrganizationDetail } from './organization-detail.svelte';

  const COLUMN_COUNT = 3;

  type Props = { detail: OrganizationDetail };

  let { detail }: Props = $props();
</script>

<div class="overflow-hidden rounded-lg border">
  <Table.Root>
    <Table.Header class="bg-muted/50">
      <Table.Row>
        <Table.Head>Description</Table.Head>
        <Table.Head class="hidden sm:table-cell">Date</Table.Head>
        <Table.Head class="text-right">Amount</Table.Head>
      </Table.Row>
    </Table.Header>
    <Table.Body>
      {#each detail.pagedCharges as charge (`${charge.type}-${charge.id}`)}
        <Table.Row>
          <Table.Cell class="max-w-64">
            <div class="truncate">{charge.description}</div>
            <div class="text-xs text-muted-foreground sm:hidden">
              {formatIsoDate(charge.date, DATE_STYLE.SHORT)}
            </div>
          </Table.Cell>
          <Table.Cell class="hidden sm:table-cell">
            {formatIsoDate(charge.date, DATE_STYLE.SHORT)}
          </Table.Cell>
          <Table.Cell class="text-right tabular-nums">
            {formatCents(charge.amount)}
          </Table.Cell>
        </Table.Row>
      {:else}
        <Table.Row>
          <Table.Cell colspan={COLUMN_COUNT} class="h-20 text-center text-muted-foreground">
            No charges found.
          </Table.Cell>
        </Table.Row>
      {/each}
    </Table.Body>
  </Table.Root>
</div>

<Pagination
  currentPage={detail.chargesPage}
  totalPages={detail.chargesPageCount}
  onPageChange={(page) => (detail.chargesPage = page)}
/>
