<script lang="ts">
  import { getBillingCodes, updateBillingCode } from '$lib/remotes/endpoints/billing_code.remote';
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
  import { mdiChatQuestion, mdiMagnify, mdiPlus, mdiTrashCan } from '@mdi/js';
  import BillingCodeModal from './BillingCodeModal.svelte';

  let billingCodes = getBillingCodes();
  let searchTerm = $state('');
  let searchedCodes = $derived(
    billingCodes.current?.filter(
      (code) =>
        code.code.toUpperCase().includes(searchTerm.toUpperCase()) ||
        code.description.toUpperCase().includes(searchTerm.toUpperCase()) ||
        code.organizationName?.toUpperCase().includes(searchTerm.toUpperCase()) ||
        code.discountName?.toUpperCase().includes(searchTerm.toUpperCase()),
    ) || [],
  );

  function showCreateModal() {
    modalManager.show(BillingCodeModal, {});
  }

  async function handleDeleteCode(id: string) {
    const confirm = await modalManager.showDialog({
      title: 'Archive Billing Code',
      prompt: 'Are you sure you want to archive this billing code?',
      confirmText: 'Archive',
      confirmColor: 'danger',
      icon: mdiChatQuestion,
    });

    if (confirm) {
      await updateBillingCode({ id, archived: true });
    }
  }
</script>

<div class="mb-6 flex items-center justify-between">
  <Heading size="large" class="inline-block w-fit">Billing Codes</Heading>
  <div class="flex w-1/3 items-center gap-2">
    <IconButton
      icon={mdiPlus}
      variant="filled"
      aria-label="Add Billing Code"
      class="min-w-10"
      onclick={showCreateModal}
    />
    <Input placeholder="Search Billing Codes" leadingIcon={mdiMagnify} bind:value={searchTerm} />
  </div>
</div>

{#if billingCodes.loading}
  <div class="flex justify-center">
    <LoadingSpinner size="large" />
  </div>
{:else if billingCodes.error}
  <p class="text-danger">Error loading billing codes: {billingCodes.error.message}</p>
{:else}
  <Table striped class="mt-4">
    <TableHeader>
      <TableHeading class="w-2/12">Code</TableHeading>
      <TableHeading class="w-3/12">Description</TableHeading>
      <TableHeading class="w-2/12">Organization</TableHeading>
      <TableHeading class="w-3/12">Discount</TableHeading>
      <TableHeading class="w-2/12">Actions</TableHeading>
    </TableHeader>
    <TableBody>
      {#each searchedCodes as code}
        <TableRow>
          <TableCell class="w-2/12 px-4 text-left font-mono">{code.code}</TableCell>
          <TableCell class="w-3/12 px-4 text-left">{code.description}</TableCell>
          <TableCell class="w-2/12 px-4 text-left">{code.organizationName || '-'}</TableCell>
          <TableCell class="w-3/12 px-4 text-left">{code.discountName || '-'}</TableCell>
          <TableCell class="w-2/12">
            <div class="flex justify-center gap-2">
              <IconButton
                icon={mdiTrashCan}
                aria-label="Delete Billing Code"
                color="danger"
                onclick={() => handleDeleteCode(code.id)}
              />
            </div>
          </TableCell>
        </TableRow>
      {/each}

      {#if searchedCodes.length === 0}
        <TableRow>
          <TableCell class="w-full text-center">No billing codes found.</TableCell>
        </TableRow>
      {/if}
    </TableBody>
  </Table>
{/if}
