<script lang="ts">
  import { Spinner } from '$lib/components/ui/spinner';
  import * as Table from '$lib/components/ui/table';
  import Pagination from '$lib/frontend/components/Pagination.svelte';
  import Section from '$lib/frontend/components/Section.svelte';
  import StatusBadge from '$lib/frontend/components/StatusBadge.svelte';
  import {
    ACCESS_BASIS_DISPLAY,
    VISIT_OUTCOME_DISPLAY,
    VISIT_SOURCE_LABEL,
    formatDateTime,
  } from '../display';
  import type { MemberDetailManager } from './member-detail.svelte';

  const COLUMN_COUNT = 4;

  type Props = { manager: MemberDetailManager };

  let { manager }: Props = $props();
</script>

<Section title="Visits" class="overflow-hidden [&>div]:p-0">
  {#if manager.visits.error}
    <p class="p-3 text-sm text-destructive">
      Error loading visits: {manager.visits.error.message}
    </p>
  {:else if !manager.visits.current}
    <div class="flex justify-center py-6">
      <Spinner class="size-5" />
    </div>
  {:else}
    <Table.Root>
      <Table.Header class="bg-muted/50">
        <Table.Row>
          <Table.Head>When</Table.Head>
          <Table.Head>Outcome</Table.Head>
          <Table.Head class="hidden sm:table-cell">Access</Table.Head>
          <Table.Head class="hidden sm:table-cell">Source</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each manager.visits.current.data as visit (visit.id)}
          {@const outcome = VISIT_OUTCOME_DISPLAY[visit.outcome]}
          <Table.Row>
            <Table.Cell>{formatDateTime(visit.scannedDate)}</Table.Cell>
            <Table.Cell>
              <StatusBadge tone={outcome.tone}>{outcome.label}</StatusBadge>
            </Table.Cell>
            <Table.Cell class="hidden sm:table-cell">
              {ACCESS_BASIS_DISPLAY[visit.accessBasis].label}
            </Table.Cell>
            <Table.Cell class="hidden sm:table-cell">
              {VISIT_SOURCE_LABEL[visit.source]}
            </Table.Cell>
          </Table.Row>
        {:else}
          <Table.Row>
            <Table.Cell colspan={COLUMN_COUNT} class="h-16 text-center text-muted-foreground">
              No visits yet.
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
    <Pagination
      currentPage={manager.visitsPage}
      totalPages={manager.visits.current.pagination.totalPages}
      onPageChange={(page) => manager.setVisitsPage(page)}
    />
  {/if}
</Section>
