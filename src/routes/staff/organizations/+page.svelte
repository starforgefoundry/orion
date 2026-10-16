<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Spinner } from '$lib/components/ui/spinner';
  import * as Table from '$lib/components/ui/table';
  import PageHeader from '$lib/frontend/components/PageHeader.svelte';
  import TextInput from '$lib/frontend/components/form/TextInput.svelte';
  import { modalManager } from '$lib/frontend/modal-manager.svelte';
  import { getOrganizations } from '$lib/remotes/endpoints/organization.remote';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import SearchIcon from '@lucide/svelte/icons/search';
  import CreateOrganizationModal from './CreateOrganizationModal.svelte';
  import OrganizationDetailModal from './OrganizationDetailModal.svelte';

  let organizations = getOrganizations();
  let searchTerm = $state('');
  let searchedOrganizations = $derived(
    organizations.current?.filter(
      (organization) =>
        organization.name.toUpperCase().includes(searchTerm.toUpperCase()) ||
        organization.email.toUpperCase().includes(searchTerm.toUpperCase()),
    ) || [],
  );

  function showCreateModal() {
    modalManager.show(CreateOrganizationModal);
  }

  function showOrganizationDetail(id: string) {
    modalManager.show(OrganizationDetailModal, { organizationId: id });
  }

  function handleRowKeydown(event: KeyboardEvent, id: string) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    showOrganizationDetail(id);
  }
</script>

<PageHeader title="Organizations">
  {#snippet actions()}
    <Button size="sm" onclick={showCreateModal}>
      <PlusIcon />
      Add Organization
    </Button>
  {/snippet}
</PageHeader>

<TextInput
  icon={SearchIcon}
  placeholder="Search Organizations"
  class="mb-3 sm:max-w-xs"
  bind:value={searchTerm}
/>

{#if organizations.loading}
  <div class="flex justify-center py-8">
    <Spinner class="size-6" />
  </div>
{:else if organizations.error}
  <p class="text-sm text-destructive">
    Error loading organizations: {organizations.error.message}
  </p>
{:else}
  <div class="overflow-hidden rounded-lg border">
    <Table.Root>
      <Table.Header class="bg-muted/50">
        <Table.Row>
          <Table.Head>Name</Table.Head>
          <Table.Head class="hidden sm:table-cell">Email</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each searchedOrganizations as organization (organization.id)}
          <Table.Row
            class="cursor-pointer"
            tabindex={0}
            onclick={() => showOrganizationDetail(organization.id)}
            onkeydown={(e) => handleRowKeydown(e, organization.id)}
          >
            <Table.Cell class="max-w-48">
              <div class="truncate font-medium">{organization.name}</div>
              <div class="truncate text-xs text-muted-foreground sm:hidden">
                {organization.email}
              </div>
            </Table.Cell>
            <Table.Cell class="hidden max-w-64 truncate sm:table-cell">
              {organization.email}
            </Table.Cell>
          </Table.Row>
        {:else}
          <Table.Row>
            <Table.Cell colspan={2} class="h-20 text-center text-muted-foreground">
              No organizations found.
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </div>
{/if}
