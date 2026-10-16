<script lang="ts">
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { Spinner } from '$lib/components/ui/spinner';
  import * as Table from '$lib/components/ui/table';
  import IconButton from '$lib/frontend/components/IconButton.svelte';
  import UserMinusIcon from '@lucide/svelte/icons/user-minus';
  import { DateTime } from 'luxon';
  import type { OrganizationMembersManager } from './organization-members.svelte';

  const COLUMN_COUNT = 5;

  type Props = { manager: OrganizationMembersManager };

  let { manager }: Props = $props();
</script>

{#if manager.members.error}
  <p class="text-sm text-destructive">Error loading members: {manager.members.error.message}</p>
{:else if !manager.members.current}
  <div class="flex justify-center py-6">
    <Spinner class="size-5" />
  </div>
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
              disabled={manager.memberships.length === 0}
              onCheckedChange={(checked) => manager.toggleAll(checked)}
            />
          </Table.Head>
          <Table.Head>Name</Table.Head>
          <Table.Head class="hidden sm:table-cell">Email</Table.Head>
          <Table.Head class="hidden sm:table-cell">Added</Table.Head>
          <Table.Head class="w-12"><span class="sr-only">Actions</span></Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each manager.members.current as { membership, member } (membership.id)}
          <Table.Row data-state={manager.isSelected(membership) ? 'selected' : undefined}>
            <Table.Cell>
              <Checkbox
                aria-label="Select {member.name}"
                checked={manager.isSelected(membership)}
                onCheckedChange={(checked) => manager.toggle(membership, checked)}
              />
            </Table.Cell>
            <Table.Cell class="max-w-48">
              <a
                href="/staff/members/{member.id}"
                class="block truncate font-medium hover:underline"
              >
                {member.name}
              </a>
              <div class="truncate text-xs text-muted-foreground sm:hidden">{member.email}</div>
            </Table.Cell>
            <Table.Cell class="hidden max-w-64 truncate sm:table-cell">{member.email}</Table.Cell>
            <Table.Cell class="hidden sm:table-cell">
              {membership.addedDate.toLocaleString(DateTime.DATE_SHORT)}
            </Table.Cell>
            <Table.Cell class="text-right">
              <IconButton
                icon={UserMinusIcon}
                aria-label="Remove Member"
                class="text-destructive hover:text-destructive"
                onclick={() => manager.remove(membership, member)}
              />
            </Table.Cell>
          </Table.Row>
        {:else}
          <Table.Row>
            <Table.Cell colspan={COLUMN_COUNT} class="h-20 text-center text-muted-foreground">
              No members yet.
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </div>
{/if}
