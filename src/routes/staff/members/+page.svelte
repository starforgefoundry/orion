<script lang="ts">
  import { goto } from '$app/navigation';
  import { Spinner } from '$lib/components/ui/spinner';
  import * as Table from '$lib/components/ui/table';
  import * as ToggleGroup from '$lib/components/ui/toggle-group';
  import PageHeader from '$lib/frontend/components/PageHeader.svelte';
  import Pagination from '$lib/frontend/components/Pagination.svelte';
  import StatusBadge from '$lib/frontend/components/StatusBadge.svelte';
  import TextInput from '$lib/frontend/components/form/TextInput.svelte';
  import { MEMBER_STATUS, type MemberStatus } from '$lib/remotes/dtos/member.dto';
  import SearchIcon from '@lucide/svelte/icons/search';
  import { ACCESS_BASIS_DISPLAY, memberHref, waiverDisplay } from './display';
  import { MembersManager } from './members.svelte';

  const COLUMN_COUNT = 4;
  const STATUS_OPTIONS: { value: MemberStatus; label: string }[] = [
    { value: MEMBER_STATUS.ACTIVE, label: 'Active' },
    { value: MEMBER_STATUS.INACTIVE, label: 'Inactive' },
    { value: MEMBER_STATUS.ALL, label: 'All' },
  ];

  const manager = new MembersManager();

  function handleRowKeydown(event: KeyboardEvent, id: string) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    goto(memberHref(id));
  }
</script>

<PageHeader title="Members" />

<div class="mb-3 flex flex-wrap items-center gap-2">
  <TextInput
    icon={SearchIcon}
    placeholder="Search name or email"
    class="sm:max-w-xs"
    value={manager.searchTerm}
    oninput={(e) => manager.setSearchTerm(e.currentTarget.value)}
  />
  <ToggleGroup.Root
    type="single"
    variant="outline"
    size="sm"
    value={manager.status}
    onValueChange={(value) => value && manager.setStatus(value as MemberStatus)}
  >
    {#each STATUS_OPTIONS as option (option.value)}
      <ToggleGroup.Item value={option.value}>{option.label}</ToggleGroup.Item>
    {/each}
  </ToggleGroup.Root>
</div>

{#if manager.results.error}
  <p class="text-sm text-destructive">Error loading members: {manager.results.error.message}</p>
{:else if !manager.results.current}
  <div class="flex justify-center py-8">
    <Spinner class="size-6" />
  </div>
{:else}
  <div class="overflow-hidden rounded-lg border">
    <Table.Root>
      <Table.Header class="bg-muted/50">
        <Table.Row>
          <Table.Head>Name</Table.Head>
          <Table.Head class="hidden md:table-cell">Email</Table.Head>
          <Table.Head>Access</Table.Head>
          <Table.Head class="hidden sm:table-cell">Waiver</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each manager.results.current.data as row (row.member.id)}
          {@const basis = ACCESS_BASIS_DISPLAY[row.basis]}
          {@const waiver = waiverDisplay(row.hasWaiver)}
          <Table.Row
            class="cursor-pointer"
            tabindex={0}
            onclick={() => goto(memberHref(row.member.id))}
            onkeydown={(e) => handleRowKeydown(e, row.member.id)}
          >
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
          </Table.Row>
        {:else}
          <Table.Row>
            <Table.Cell colspan={COLUMN_COUNT} class="h-20 text-center text-muted-foreground">
              No members found.
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </div>

  <Pagination
    currentPage={manager.page}
    totalPages={manager.results.current.pagination.totalPages}
    onPageChange={(page) => manager.setPage(page)}
  />
{/if}
