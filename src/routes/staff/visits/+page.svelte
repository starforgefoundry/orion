<script lang="ts">
  import { Spinner } from '$lib/components/ui/spinner';
  import * as Table from '$lib/components/ui/table';
  import PageHeader from '$lib/frontend/components/PageHeader.svelte';
  import Pagination from '$lib/frontend/components/Pagination.svelte';
  import StatusBadge from '$lib/frontend/components/StatusBadge.svelte';
  import { getRecentVisits } from '$lib/remotes/endpoints/member.remote';
  import {
    ACCESS_BASIS_DISPLAY,
    VISIT_OUTCOME_DISPLAY,
    VISIT_SOURCE_LABEL,
    formatDateTime,
    memberHref,
  } from '../members/display';

  const COLUMN_COUNT = 5;

  let currentPage = $state(1);
  let visits = $derived(getRecentVisits({ page: currentPage }));
</script>

<svelte:window onfocus={() => visits.refresh()} />

<PageHeader title="Visits" />

{#if visits.error}
  <p class="text-sm text-destructive">Error loading visits: {visits.error.message}</p>
{:else if !visits.current}
  <div class="flex justify-center py-8">
    <Spinner class="size-6" />
  </div>
{:else}
  <div class="overflow-hidden rounded-lg border">
    <Table.Root>
      <Table.Header class="bg-muted/50">
        <Table.Row>
          <Table.Head>Member</Table.Head>
          <Table.Head class="hidden sm:table-cell">When</Table.Head>
          <Table.Head>Outcome</Table.Head>
          <Table.Head class="hidden md:table-cell">Access</Table.Head>
          <Table.Head class="hidden md:table-cell">Source</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each visits.current.data as { visit, member } (visit.id)}
          {@const outcome = VISIT_OUTCOME_DISPLAY[visit.outcome]}
          <Table.Row>
            <Table.Cell class="max-w-48">
              <a href={memberHref(member.id)} class="block truncate font-medium hover:underline">
                {member.name}
              </a>
              <div class="truncate text-xs text-muted-foreground sm:hidden">
                {formatDateTime(visit.scannedDate)}
              </div>
            </Table.Cell>
            <Table.Cell class="hidden sm:table-cell">
              {formatDateTime(visit.scannedDate)}
            </Table.Cell>
            <Table.Cell>
              <StatusBadge tone={outcome.tone}>{outcome.label}</StatusBadge>
            </Table.Cell>
            <Table.Cell class="hidden md:table-cell">
              {ACCESS_BASIS_DISPLAY[visit.accessBasis].label}
            </Table.Cell>
            <Table.Cell class="hidden md:table-cell">{VISIT_SOURCE_LABEL[visit.source]}</Table.Cell>
          </Table.Row>
        {:else}
          <Table.Row>
            <Table.Cell colspan={COLUMN_COUNT} class="h-20 text-center text-muted-foreground">
              No visits yet.
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </div>

  <Pagination
    {currentPage}
    totalPages={visits.current.pagination.totalPages}
    onPageChange={(page) => (currentPage = page)}
  />
{/if}
