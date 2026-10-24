<script lang="ts">
  import { Spinner } from '$lib/components/ui/spinner';
  import * as Table from '$lib/components/ui/table';
  import IconButton from '$lib/frontend/components/IconButton.svelte';
  import { modalManager } from '$lib/frontend/modal-manager.svelte';
  import {
    getBillingCodesForOrganization,
    updateBillingCode,
  } from '$lib/remotes/endpoints/billing_code.remote';
  import ArchiveIcon from '@lucide/svelte/icons/archive';

  const COLUMN_COUNT = 3;

  type Props = { organizationId: string };

  let { organizationId }: Props = $props();

  let codes = $derived(getBillingCodesForOrganization(organizationId));

  async function archive(id: string) {
    const confirmed = await modalManager.confirm({
      title: 'Archive Group Code',
      prompt: 'Customers will no longer be able to bill print requests with this code.',
      confirmText: 'Archive',
      variant: 'destructive',
    });
    if (confirmed) await updateBillingCode({ id, archived: true });
  }
</script>

{#if codes.error}
  <p class="text-sm text-destructive">Error loading group codes: {codes.error.message}</p>
{:else if !codes.current}
  <div class="flex justify-center py-6">
    <Spinner class="size-5" />
  </div>
{:else}
  <div class="overflow-hidden rounded-lg border">
    <Table.Root>
      <Table.Header class="bg-muted/50">
        <Table.Row>
          <Table.Head>Code</Table.Head>
          <Table.Head class="hidden sm:table-cell">Description</Table.Head>
          <Table.Head class="w-12"><span class="sr-only">Actions</span></Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each codes.current as code (code.id)}
          <Table.Row>
            <Table.Cell class="max-w-48">
              <div class="truncate font-mono font-medium">{code.code}</div>
              <div class="truncate text-xs text-muted-foreground sm:hidden">
                {code.description}
              </div>
            </Table.Cell>
            <Table.Cell class="hidden max-w-64 truncate sm:table-cell">
              {code.description}
            </Table.Cell>
            <Table.Cell class="text-right">
              <IconButton
                icon={ArchiveIcon}
                aria-label="Archive Group Code"
                class="text-destructive hover:text-destructive"
                onclick={() => archive(code.id)}
              />
            </Table.Cell>
          </Table.Row>
        {:else}
          <Table.Row>
            <Table.Cell colspan={COLUMN_COUNT} class="h-20 text-center text-muted-foreground">
              No group codes yet.
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </div>
{/if}
