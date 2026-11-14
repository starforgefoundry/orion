<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import { Spinner } from '$lib/components/ui/spinner';
  import QueryState from '$lib/frontend/components/QueryState.svelte';
  import { getEnabledServices } from '$lib/remotes/endpoints/service.remote';
  import { formatCents } from '$lib/utils/billing';
  import { SERVICE_PRICING } from '$lib/utils/services';

  const servicesQuery = $derived(getEnabledServices());
</script>

<svelte:head>
  <title>Starforge Services</title>
</svelte:head>

<QueryState query={servicesQuery} label="services">
  {#snippet pending()}
    <Spinner class="mx-auto mt-12 size-8" />
  {/snippet}
  {#snippet children(services)}
    {#if services.length === 0}
      <p class="rounded-lg border p-6 text-center text-sm text-muted-foreground">
        No services are currently available.
      </p>
    {:else}
      <div class="grid gap-4 md:grid-cols-2">
        {#each services as service (service.id)}
          <Card.Root size="sm" class="h-full">
            <Card.Header>
              <Card.Title>{service.name}</Card.Title>
              <Card.Description class="line-clamp-3">{service.description}</Card.Description>
            </Card.Header>
            <Card.Content class="text-sm font-medium">
              {service.pricingMode === SERVICE_PRICING.FIXED
                ? formatCents(service.price)
                : 'Quote after review'}
            </Card.Content>
            <Card.Footer class="mt-auto">
              <Button variant="outline" size="sm" class="w-full" href="/services/{service.id}">
                Request Service
              </Button>
            </Card.Footer>
          </Card.Root>
        {/each}
      </div>
    {/if}
  {/snippet}
</QueryState>
