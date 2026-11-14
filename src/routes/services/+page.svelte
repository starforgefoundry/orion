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
      <ul class="grid gap-4 md:grid-cols-2">
        {#each services as service (service.id)}
          {@const variable = service.pricingMode === SERVICE_PRICING.VARIABLE}
          {@const action = variable ? 'Request a Quote' : 'Request Service'}
          <li>
            <Card.Root size="sm" class="h-full">
              <Card.Header>
                <Card.Title><h2>{service.name}</h2></Card.Title>
                <Card.Description class="line-clamp-3">{service.description}</Card.Description>
              </Card.Header>
              <Card.Content class="text-sm font-medium">
                {#if variable}
                  Price: Free quote
                {:else}
                  Price: {service.price > 0 ? formatCents(service.price) : 'Free'}
                {/if}
              </Card.Content>
              <Card.Footer class="mt-auto">
                <Button
                  variant="outline"
                  size="sm"
                  class="w-full"
                  href="/services/{service.id}"
                  aria-label={`${action} for ${service.name}`}
                >
                  {action}
                </Button>
              </Card.Footer>
            </Card.Root>
          </li>
        {/each}
      </ul>
    {/if}
  {/snippet}
</QueryState>
