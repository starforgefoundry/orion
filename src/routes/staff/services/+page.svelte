<script lang="ts">
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import * as Table from '$lib/components/ui/table';
  import IconButton from '$lib/frontend/components/IconButton.svelte';
  import PageHeader from '$lib/frontend/components/PageHeader.svelte';
  import QueryState from '$lib/frontend/components/QueryState.svelte';
  import { modalManager } from '$lib/frontend/modal-manager.svelte';
  import { getServices } from '$lib/remotes/endpoints/service.remote';
  import { formatCents } from '$lib/utils/billing';
  import { SERVICE_PRICING } from '$lib/utils/services';
  import PencilIcon from '@lucide/svelte/icons/pencil';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import ServiceModal from './ServiceModal.svelte';

  const servicesQuery = $derived(getServices());
</script>

<PageHeader title="Service Catalog" formHref="/services">
  {#snippet actions()}
    <Button variant="outline" href="/staff/service_requests/queue">Requests</Button>
    <Button onclick={() => modalManager.show(ServiceModal, {})}>
      <PlusIcon />
      Add Service
    </Button>
  {/snippet}
</PageHeader>

<QueryState query={servicesQuery} label="services">
  {#snippet children(services)}
    <div class="overflow-hidden rounded-lg border">
      <Table.Root>
        <Table.Header class="bg-muted/50">
          <Table.Row>
            <Table.Head>Name</Table.Head>
            <Table.Head>Pricing</Table.Head>
            <Table.Head class="text-right">Fields</Table.Head>
            <Table.Head class="w-12"><span class="sr-only">Actions</span></Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each services as service (service.id)}
            <Table.Row>
              <Table.Cell class="font-medium">
                {service.name}
                {#if !service.enabled}<Badge variant="secondary" class="ml-2">Closed</Badge>{/if}
              </Table.Cell>
              <Table.Cell>
                {service.pricingMode === SERVICE_PRICING.FIXED
                  ? formatCents(service.price)
                  : 'Quoted per request'}
              </Table.Cell>
              <Table.Cell class="text-right tabular-nums">{service.fields.length}</Table.Cell>
              <Table.Cell class="py-1.5 text-right">
                <IconButton
                  icon={PencilIcon}
                  aria-label="Edit service"
                  onclick={() => modalManager.show(ServiceModal, { service })}
                />
              </Table.Cell>
            </Table.Row>
          {:else}
            <Table.Row>
              <Table.Cell colspan={4} class="h-20 text-center text-muted-foreground">
                No services yet.
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    </div>
  {/snippet}
</QueryState>
