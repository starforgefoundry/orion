<script lang="ts">
  import { getOrganizations } from '$lib/remotes/endpoints/organization.remote';
  import {
    Heading,
    IconButton,
    Input,
    LoadingSpinner,
    modalManager,
    Table,
    TableBody,
    TableCell,
    TableHeader,
    TableHeading,
    TableRow,
  } from '@immich/ui';
  import { mdiEye, mdiMagnify, mdiPlus } from '@mdi/js';
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
</script>

<div class="mb-6 flex items-center justify-between">
  <Heading size="large" class="inline-block w-fit">Organizations</Heading>
  <div class="flex w-1/3 items-center gap-2">
    <IconButton
      icon={mdiPlus}
      variant="filled"
      aria-label="Add Organization"
      class="min-w-10"
      onclick={showCreateModal}
    />
    <Input placeholder="Search Organizations" leadingIcon={mdiMagnify} bind:value={searchTerm} />
  </div>
</div>

{#if organizations.loading}
  <div class="flex justify-center">
    <LoadingSpinner size="large" />
  </div>
{:else if organizations.error}
  <p class="text-danger">Error loading organizations: {organizations.error.message}</p>
{:else}
  <Table striped class="mt-4">
    <TableHeader>
      <TableHeading class="w-4/12 text-left">Name</TableHeading>
      <TableHeading class="w-6/12 text-left">Email</TableHeading>
      <TableHeading class="w-2/12 text-left">Actions</TableHeading>
    </TableHeader>
    <TableBody>
      {#each searchedOrganizations as organization}
        <TableRow>
          <TableCell class="w-4/12 px-4 text-left">{organization.name}</TableCell>
          <TableCell class="w-6/12 px-4 text-left">{organization.email}</TableCell>
          <TableCell class="w-2/12 px-4 text-left">
            <IconButton
              aria-label="View Organization Details"
              icon={mdiEye}
              onclick={() => showOrganizationDetail(organization.id)}
            />
          </TableCell>
        </TableRow>
      {/each}

      {#if searchedOrganizations.length === 0}
        <TableRow>
          <TableCell class="w-full text-center">No organizations found.</TableCell>
        </TableRow>
      {/if}
    </TableBody>
  </Table>
{/if}
