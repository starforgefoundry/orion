<script lang="ts">
  import { goto } from '$app/navigation';
  import { Button } from '$lib/components/ui/button';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { Spinner } from '$lib/components/ui/spinner';
  import * as Table from '$lib/components/ui/table';
  import PageHeader from '$lib/frontend/components/PageHeader.svelte';
  import Pagination from '$lib/frontend/components/Pagination.svelte';
  import StatusBadge from '$lib/frontend/components/StatusBadge.svelte';
  import TextInput from '$lib/frontend/components/form/TextInput.svelte';
  import { enumValues, ACCESS_BASIS } from '$lib/member_enums';
  import { MEMBER_SORT, ONBOARDING_FILTER } from '$lib/remotes/dtos/member.dto';
  import type { MemberSort } from '$lib/remotes/dtos/member.dto';
  import MailIcon from '@lucide/svelte/icons/mail';
  import SearchIcon from '@lucide/svelte/icons/search';
  import XIcon from '@lucide/svelte/icons/x';
  import ColumnHeader from './ColumnHeader.svelte';
  import {
    ACCESS_BASIS_DISPLAY,
    ONBOARDING_FILTER_LABEL,
    WAIVER_FILTER_LABEL,
    formatDate,
    memberHref,
    waiverDisplay,
  } from './display';
  import { MembersManager, type FilterKey, type MemberFilters } from './members.svelte';

  const COLUMN_COUNT = 6;

  const manager = new MembersManager();

  function sortFor(sort: MemberSort) {
    return {
      direction: manager.sortDirection(sort),
      onSort: (direction: typeof manager.direction) => manager.sortBy(sort, direction),
    };
  }

  function filterFor<K extends FilterKey>(
    key: K,
    labels: Record<MemberFilters[K][number], string>,
  ) {
    type Value = MemberFilters[K][number];
    return {
      options: (Object.keys(labels) as Value[]).map((value) => ({ value, label: labels[value] })),
      isSelected: (value: Value) => manager.isFiltered(key, value),
      onToggle: (value: Value, checked: boolean) => manager.toggleFilter(key, value, checked),
      onClear: () => manager.clearFilter(key),
    };
  }

  const accessLabels = Object.fromEntries(
    enumValues(ACCESS_BASIS).map((basis) => [basis, ACCESS_BASIS_DISPLAY[basis].label]),
  ) as Record<MemberFilters['access'][number], string>;

  function handleRowKeydown(event: KeyboardEvent, id: string) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    goto(memberHref(id));
  }
</script>

<PageHeader title="Members" formHref="/pass" />

<div class="mb-3 flex flex-wrap items-center gap-2">
  <TextInput
    icon={SearchIcon}
    placeholder="Search name or email"
    class="sm:max-w-xs"
    value={manager.searchTerm}
    oninput={(e) => manager.setSearchTerm(e.currentTarget.value)}
  />
  {#if manager.hasFilters}
    <Button variant="ghost" size="sm" onclick={() => manager.clearFilters()}>
      <XIcon />
      Clear filters
    </Button>
  {/if}
  {#if manager.selected.size > 0}
    <Button
      size="sm"
      class="ml-auto"
      disabled={manager.sending}
      onclick={() => manager.sendOnboardingToSelected()}
    >
      {#if manager.sending}<Spinner />{:else}<MailIcon />{/if}
      Send Onboarding ({manager.selected.size})
    </Button>
  {/if}
</div>

{#if manager.results.error}
  <p class="text-sm text-destructive">Error loading members: {manager.results.error.message}</p>
{:else}
  <div class="overflow-hidden rounded-lg border">
    <Table.Root>
      <Table.Header class="bg-muted/50">
        <Table.Row>
          <Table.Head class="w-10">
            <Checkbox
              aria-label="Select all members"
              checked={manager.allSelected}
              indeterminate={manager.someSelected}
              disabled={manager.rows.length === 0}
              onCheckedChange={(checked) => manager.toggleAll(checked)}
            />
          </Table.Head>
          <Table.Head>
            <ColumnHeader label="Name" sort={sortFor(MEMBER_SORT.NAME)} />
          </Table.Head>
          <Table.Head class="hidden md:table-cell">
            <ColumnHeader label="Email" sort={sortFor(MEMBER_SORT.EMAIL)} />
          </Table.Head>
          <Table.Head>
            <ColumnHeader label="Access" filter={filterFor('access', accessLabels)} />
          </Table.Head>
          <Table.Head class="hidden sm:table-cell">
            <ColumnHeader label="Waiver" filter={filterFor('waiver', WAIVER_FILTER_LABEL)} />
          </Table.Head>
          <Table.Head class="hidden lg:table-cell">
            <ColumnHeader
              label="Onboarding"
              sort={sortFor(MEMBER_SORT.ONBOARDING_SENT)}
              filter={filterFor('onboarding', ONBOARDING_FILTER_LABEL)}
            />
          </Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#if !manager.results.current}
          <Table.Row>
            <Table.Cell colspan={COLUMN_COUNT} class="h-20">
              <div class="flex justify-center"><Spinner class="size-6" /></div>
            </Table.Cell>
          </Table.Row>
        {:else}
          {#each manager.rows as row (row.member.id)}
            {@const basis = ACCESS_BASIS_DISPLAY[row.basis]}
            {@const waiver = waiverDisplay(row.hasWaiver)}
            <Table.Row
              class="cursor-pointer"
              tabindex={0}
              data-state={manager.isSelected(row.member.id) ? 'selected' : undefined}
              onclick={() => goto(memberHref(row.member.id))}
              onkeydown={(e) => handleRowKeydown(e, row.member.id)}
            >
              <Table.Cell
                onclick={(e) => e.stopPropagation()}
                onkeydown={(e) => e.stopPropagation()}
              >
                <Checkbox
                  aria-label="Select {row.member.name}"
                  checked={manager.isSelected(row.member.id)}
                  onCheckedChange={(checked) => manager.toggle(row.member.id, checked)}
                />
              </Table.Cell>
              <Table.Cell class="max-w-48">
                <div class="truncate font-medium">{row.member.name}</div>
                <div class="truncate text-xs text-muted-foreground md:hidden">
                  {row.member.email}
                </div>
              </Table.Cell>
              <Table.Cell class="hidden max-w-64 truncate md:table-cell">
                {row.member.email}
              </Table.Cell>
              <Table.Cell>
                <StatusBadge tone={basis.tone}>{basis.label}</StatusBadge>
                {#if !row.hasWaiver}
                  <StatusBadge tone={waiver.tone} class="sm:hidden">No Waiver</StatusBadge>
                {/if}
              </Table.Cell>
              <Table.Cell class="hidden sm:table-cell">
                <StatusBadge tone={waiver.tone}>{waiver.label}</StatusBadge>
              </Table.Cell>
              <Table.Cell class="hidden text-muted-foreground lg:table-cell">
                {row.lastOnboardingSentDate
                  ? formatDate(row.lastOnboardingSentDate)
                  : ONBOARDING_FILTER_LABEL[ONBOARDING_FILTER.NOT_SENT]}
              </Table.Cell>
            </Table.Row>
          {:else}
            <Table.Row>
              <Table.Cell colspan={COLUMN_COUNT} class="h-20 text-center text-muted-foreground">
                No members found.
              </Table.Cell>
            </Table.Row>
          {/each}
        {/if}
      </Table.Body>
    </Table.Root>
  </div>

  {#if manager.results.current}
    <Pagination
      currentPage={manager.page}
      totalPages={manager.results.current.pagination.totalPages}
      onPageChange={(page) => manager.setPage(page)}
    />
  {/if}
{/if}
