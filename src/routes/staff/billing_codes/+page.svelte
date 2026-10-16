<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Spinner } from '$lib/components/ui/spinner';
  import * as Table from '$lib/components/ui/table';
  import IconButton from '$lib/frontend/components/IconButton.svelte';
  import PageHeader from '$lib/frontend/components/PageHeader.svelte';
  import TextInput from '$lib/frontend/components/form/TextInput.svelte';
  import { modalManager } from '$lib/frontend/modal-manager.svelte';
  import { getBillingCodes, updateBillingCode } from '$lib/remotes/endpoints/billing_code.remote';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import SearchIcon from '@lucide/svelte/icons/search';
  import TrashIcon from '@lucide/svelte/icons/trash';
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
    const confirm = await modalManager.confirm({
      title: 'Archive Billing Code',
      prompt: 'Are you sure you want to archive this billing code?',
      confirmText: 'Archive',
      variant: 'destructive',
    });

    if (confirm) {
      await updateBillingCode({ id, archived: true });
    }
  }
</script>

<PageHeader title="Billing Codes">
  {#snippet actions()}
    <Button size="sm" onclick={showCreateModal}>
      <PlusIcon />
      Add Billing Code
    </Button>
  {/snippet}
</PageHeader>

<TextInput
  icon={SearchIcon}
  placeholder="Search Billing Codes"
  class="mb-3 sm:max-w-xs"
  bind:value={searchTerm}
/>

{#if billingCodes.loading}
  <div class="flex justify-center py-8">
    <Spinner class="size-6" />
  </div>
{:else if billingCodes.error}
  <p class="text-sm text-destructive">Error loading billing codes: {billingCodes.error.message}</p>
{:else}
  <div class="overflow-hidden rounded-lg border">
    <Table.Root>
      <Table.Header class="bg-muted/50">
        <Table.Row>
          <Table.Head>Code</Table.Head>
          <Table.Head class="hidden md:table-cell">Description</Table.Head>
          <Table.Head class="hidden sm:table-cell">Organization</Table.Head>
          <Table.Head class="hidden lg:table-cell">Discount</Table.Head>
          <Table.Head class="w-12"><span class="sr-only">Actions</span></Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each searchedCodes as code (code.id)}
          <Table.Row>
            <Table.Cell class="max-w-48">
              <div class="truncate font-mono font-medium">{code.code}</div>
              <div class="truncate text-xs text-muted-foreground md:hidden">
                {code.description}
              </div>
            </Table.Cell>
            <Table.Cell class="hidden max-w-64 truncate md:table-cell">
              {code.description}
            </Table.Cell>
            <Table.Cell class="hidden sm:table-cell">{code.organizationName || '—'}</Table.Cell>
            <Table.Cell class="hidden lg:table-cell">{code.discountName || '—'}</Table.Cell>
            <Table.Cell class="text-right">
              <IconButton
                icon={TrashIcon}
                aria-label="Archive Billing Code"
                class="text-destructive hover:text-destructive"
                onclick={() => handleDeleteCode(code.id)}
              />
            </Table.Cell>
          </Table.Row>
        {:else}
          <Table.Row>
            <Table.Cell colspan={5} class="h-20 text-center text-muted-foreground">
              No billing codes found.
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </div>
{/if}
