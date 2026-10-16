<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import * as Table from '$lib/components/ui/table';
  import Section from '$lib/frontend/components/Section.svelte';
  import StatusBadge from '$lib/frontend/components/StatusBadge.svelte';
  import type { MemberSubscription } from '$lib/server/db/schema';
  import { SUBSCRIPTION_STATUS_DISPLAY, formatDate, formatIsoDate } from '../display';
  import type { MemberDetailManager } from './member-detail.svelte';

  const COLUMN_COUNT = 7;

  type Props = {
    subscriptions: MemberSubscription[];
    manager: MemberDetailManager;
  };

  let { subscriptions, manager }: Props = $props();
</script>

<Section title="Subscriptions" class="overflow-hidden [&>div]:p-0">
  <Table.Root>
    <Table.Header class="bg-muted/50">
      <Table.Row>
        <Table.Head>Plan</Table.Head>
        <Table.Head>Status</Table.Head>
        <Table.Head class="hidden md:table-cell">Started</Table.Head>
        <Table.Head class="hidden md:table-cell">Charged Through</Table.Head>
        <Table.Head class="hidden lg:table-cell">Canceled</Table.Head>
        <Table.Head class="hidden lg:table-cell">Access Ended</Table.Head>
        <Table.Head class="w-12"><span class="sr-only">Actions</span></Table.Head>
      </Table.Row>
    </Table.Header>
    <Table.Body>
      {#each subscriptions as subscription (subscription.id)}
        {@const status = SUBSCRIPTION_STATUS_DISPLAY[subscription.status]}
        <Table.Row>
          <Table.Cell class="max-w-48">
            <div class="truncate font-medium">{subscription.planName}</div>
            <div class="text-xs text-muted-foreground md:hidden">
              Through {formatIsoDate(subscription.chargedThroughDate)}
            </div>
          </Table.Cell>
          <Table.Cell>
            <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
          </Table.Cell>
          <Table.Cell class="hidden md:table-cell">
            {formatIsoDate(subscription.startDate)}
          </Table.Cell>
          <Table.Cell class="hidden md:table-cell">
            {formatIsoDate(subscription.chargedThroughDate)}
          </Table.Cell>
          <Table.Cell class="hidden lg:table-cell">
            {formatIsoDate(subscription.canceledDate)}
          </Table.Cell>
          <Table.Cell class="hidden lg:table-cell">
            {formatDate(subscription.accessEndedDate)}
          </Table.Cell>
          <Table.Cell class="text-right">
            {#if manager.canCancel(subscription)}
              <Button
                size="sm"
                variant="outline"
                class="text-destructive hover:text-destructive"
                onclick={() => manager.cancelSubscription(subscription)}
              >
                {subscription.canceledDate ? 'Refund' : 'Cancel'}
              </Button>
            {/if}
          </Table.Cell>
        </Table.Row>
      {:else}
        <Table.Row>
          <Table.Cell colspan={COLUMN_COUNT} class="h-16 text-center text-muted-foreground">
            No subscriptions.
          </Table.Cell>
        </Table.Row>
      {/each}
    </Table.Body>
  </Table.Root>
</Section>
