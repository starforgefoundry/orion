<script lang="ts">
  import * as Table from '$lib/components/ui/table';
  import { Spinner } from '$lib/components/ui/spinner';
  import IconButton from '$lib/frontend/components/IconButton.svelte';
  import PageHeader from '$lib/frontend/components/PageHeader.svelte';
  import TextInput from '$lib/frontend/components/form/TextInput.svelte';
  import { searchWaivers } from '$lib/remotes/endpoints/waiver.remote';
  import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
  import EyeIcon from '@lucide/svelte/icons/eye';
  import SearchIcon from '@lucide/svelte/icons/search';
  import UserIcon from '@lucide/svelte/icons/user';
  import { goto } from '$app/navigation';

  let searchTerm = $state('');
  let page = $state(1);
  const pageSize = 25;

  let waivers = $state(searchWaivers({ query: '', page: 1, pageSize }));

  let debounceTimer: ReturnType<typeof setTimeout>;
  function handleSearch(value: string) {
    searchTerm = value;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      page = 1;
      waivers = searchWaivers({ query: searchTerm, page: 1, pageSize });
    }, 300);
  }

  function handlePrevPage() {
    if (page > 1) {
      page--;
      waivers = searchWaivers({ query: searchTerm, page, pageSize });
    }
  }

  function handleNextPage() {
    if (waivers.current && page < waivers.current.pagination.totalPages) {
      page++;
      waivers = searchWaivers({ query: searchTerm, page, pageSize });
    }
  }

  function formatDate(date: unknown) {
    if (!date) return '';
    if (typeof date === 'object' && 'toLocaleString' in date) {
      return (date as { toLocaleString: (opts: object) => string }).toLocaleString({
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
    const d = new Date(String(date));
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function viewWaiver(waiverId: string) {
    window.open(`/staff/waivers/view/${waiverId}`, '_blank');
  }
</script>

<PageHeader title="Signed Waivers" />

<TextInput
  icon={SearchIcon}
  placeholder="Search waivers..."
  class="mb-3 sm:max-w-xs"
  value={searchTerm}
  oninput={(e) => handleSearch(e.currentTarget.value)}
/>

{#if waivers.loading}
  <div class="flex justify-center py-8">
    <Spinner class="size-6" />
  </div>
{:else if waivers.error}
  <p class="text-sm text-destructive">Error loading waivers: {waivers.error.message}</p>
{:else if waivers.current}
  <div class="overflow-hidden rounded-lg border">
    <Table.Root>
      <Table.Header class="bg-muted/50">
        <Table.Row>
          <Table.Head>Name</Table.Head>
          <Table.Head class="hidden md:table-cell">Email</Table.Head>
          <Table.Head class="hidden sm:table-cell">Signed Date</Table.Head>
          <Table.Head class="w-20"><span class="sr-only">Actions</span></Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each waivers.current.data as waiver (waiver.id)}
          <Table.Row>
            <Table.Cell class="max-w-48">
              <div class="truncate font-medium">{waiver.name}</div>
              <div class="truncate text-xs text-muted-foreground md:hidden">{waiver.email}</div>
              <div class="truncate text-xs text-muted-foreground sm:hidden">
                {formatDate(waiver.signedDate)}
              </div>
            </Table.Cell>
            <Table.Cell class="hidden max-w-64 truncate md:table-cell">{waiver.email}</Table.Cell>
            <Table.Cell class="hidden sm:table-cell">{formatDate(waiver.signedDate)}</Table.Cell>
            <Table.Cell class="text-right whitespace-nowrap">
              <IconButton
                icon={UserIcon}
                aria-label="View Member"
                onclick={() => goto(`/staff/members/${waiver.memberId}`)}
              />
              <IconButton
                icon={EyeIcon}
                aria-label="View Waiver"
                onclick={() => viewWaiver(waiver.id)}
              />
            </Table.Cell>
          </Table.Row>
        {:else}
          <Table.Row>
            <Table.Cell colspan={4} class="h-20 text-center text-muted-foreground">
              No waivers found.
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </div>

  {#if waivers.current.pagination.totalPages > 1}
    <div class="mt-3 flex items-center justify-center gap-3">
      <IconButton
        icon={ChevronLeftIcon}
        aria-label="Previous page"
        disabled={page <= 1}
        onclick={handlePrevPage}
      />
      <span class="text-sm">
        Page {waivers.current.pagination.page} of {waivers.current.pagination.totalPages}
      </span>
      <IconButton
        icon={ChevronRightIcon}
        aria-label="Next page"
        disabled={page >= waivers.current.pagination.totalPages}
        onclick={handleNextPage}
      />
    </div>
  {/if}
{/if}
