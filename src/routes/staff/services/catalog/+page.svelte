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
  import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
  import PencilIcon from '@lucide/svelte/icons/pencil';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import ServiceModal from './ServiceModal.svelte';

  const servicesQuery = $derived(getServices());
</script>

<PageHeader title="Service Catalog" formHref="/services">
  {#snippet actions()}
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
            <Table.Head>Status</Table.Head>
            <Table.Head class="hidden sm:table-cell">Pricing</Table.Head>
            <Table.Head class="hidden text-right sm:table-cell">Fields</Table.Head>
            <Table.Head class="w-24"><span class="sr-only">Actions</span></Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each services as service (service.id)}
            {@const pricing =
              service.pricingMode === SERVICE_PRICING.VARIABLE
                ? 'Quoted per request'
                : service.price > 0
                  ? formatCents(service.price)
                  : 'Free'}
            <Table.Row>
              <Table.Cell class="font-medium whitespace-normal">
                {service.name}
                <!-- Phones hide the Pricing column, so the price sits under the name. -->
                <span class="block text-xs font-normal text-muted-foreground sm:hidden">
                  {pricing}
                </span>
              </Table.Cell>
              <Table.Cell>
                {#if service.enabled}
                  <Badge>Open</Badge>
                {:else}
                  <Badge variant="secondary">Closed</Badge>
                {/if}
              </Table.Cell>
              <Table.Cell class="hidden sm:table-cell">{pricing}</Table.Cell>
              <Table.Cell class="hidden text-right tabular-nums sm:table-cell">
                {service.fields.length}
              </Table.Cell>
              <Table.Cell class="py-1.5 text-right">
                <IconButton
                  icon={ExternalLinkIcon}
                  aria-label={`Open the public form for ${service.name}`}
                  href="/services/{service.id}"
                  target="_blank"
                  rel="noopener"
                />
                <IconButton
                  icon={PencilIcon}
                  aria-label={`Edit ${service.name}`}
                  onclick={() => modalManager.show(ServiceModal, { service })}
                />
              </Table.Cell>
            </Table.Row>
          {:else}
            <Table.Row>
              <Table.Cell colspan={5} class="h-20 text-center text-muted-foreground">
                No services yet.
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    </div>
  {/snippet}
</QueryState>
