<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Switch } from '$lib/components/ui/switch';
  import OptionSelect from '$lib/frontend/components/form/OptionSelect.svelte';
  import PriceInput from '$lib/frontend/components/form/PriceInput.svelte';
  import PageHeader from '$lib/frontend/components/PageHeader.svelte';
  import QueryState from '$lib/frontend/components/QueryState.svelte';
  import { submitWithToast } from '$lib/frontend/form-submit';
  import {
    getServiceRequests,
    quoteServiceRequest,
    updateServiceRequestStatus,
  } from '$lib/remotes/endpoints/service.remote';
  import { CENTS_PER_DOLLAR, formatCents } from '$lib/utils/billing';
  import {
    canQuote,
    isClosed,
    SERVICE_FIELD_TYPE,
    SERVICE_REQUEST_STATUS,
    type ServiceRequestStatus,
  } from '$lib/utils/services';

  const requestsQuery = $derived(getServiceRequests());

  const STATUS_OPTIONS = [
    { value: SERVICE_REQUEST_STATUS.SUBMITTED, label: 'Submitted' },
    { value: SERVICE_REQUEST_STATUS.QUOTED, label: 'Quoted' },
    { value: SERVICE_REQUEST_STATUS.IN_PROGRESS, label: 'In progress' },
    { value: SERVICE_REQUEST_STATUS.DONE, label: 'Done' },
    { value: SERVICE_REQUEST_STATUS.CANCELED, label: 'Canceled' },
  ];
  const MESSAGES = { success: 'Request updated', error: 'Failed to update request' };

  // Quotes being typed, in cents, by request id.
  let quotes = $state<Record<string, number>>({});
  let showClosed = $state(false);
</script>

<PageHeader title="Service Requests">
  {#snippet actions()}
    <label class="flex items-center gap-2 text-sm">
      <Switch bind:checked={showClosed} /> Show done and canceled
    </label>
    <Button variant="outline" href="/staff/services/catalog">Catalog</Button>
  {/snippet}
</PageHeader>

<QueryState query={requestsQuery} label="requests">
  {#snippet children(rows)}
    <div class="flex flex-col gap-3">
      {#each rows.filter(({ request }) => showClosed || !isClosed(request.status)) as { request, serviceName, files } (request.id)}
        <div class="flex flex-col gap-3 rounded-lg border p-4">
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="font-medium">{serviceName}</p>
              <p class="truncate text-sm text-muted-foreground">
                {request.customerName} · {request.email}
              </p>
            </div>
            <label class="flex items-center gap-2 text-sm">
              <span class="sr-only">Status</span>
              <OptionSelect
                class="w-40"
                options={STATUS_OPTIONS}
                value={request.status}
                onValueChange={(status) =>
                  submitWithToast(
                    () =>
                      updateServiceRequestStatus({
                        id: request.id,
                        status: status as ServiceRequestStatus,
                      }),
                    MESSAGES,
                  )}
              />
            </label>
          </div>

          {#if Object.keys(request.answers).length > 0}
            <dl class="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
              {#each request.fields.filter((field) => field.id in request.answers) as field (field.id)}
                <dt class="text-muted-foreground">{field.label}</dt>
                <dd class="break-words whitespace-pre-line">
                  {#if files[field.id]}
                    <a href={files[field.id].url} class="underline" download>
                      {files[field.id].name}
                    </a>
                  {:else if field.type === SERVICE_FIELD_TYPE.CHECKBOX}
                    Yes
                  {:else}
                    {String(request.answers[field.id])}
                  {/if}
                </dd>
              {/each}
            </dl>
          {/if}

          <div class="flex flex-wrap items-center gap-2 text-sm">
            {#if request.price !== null}
              <span>Price: <strong>{formatCents(request.price)}</strong></span>
            {/if}
            {#if canQuote(request)}
              <label class="w-32">
                <span class="sr-only">Quote</span>
                <PriceInput
                  bind:value={
                    () => quotes[request.id] ?? 0, (cents) => (quotes[request.id] = cents)
                  }
                  multiplier={CENTS_PER_DOLLAR}
                />
              </label>
              <Button
                size="sm"
                disabled={!(quotes[request.id] > 0)}
                onclick={() =>
                  submitWithToast(
                    () => quoteServiceRequest({ id: request.id, price: quotes[request.id] ?? 0 }),
                    { success: 'Quote saved', error: 'Failed to save quote' },
                  )}
              >
                {request.price === null ? 'Save Quote' : 'Update Quote'}
              </Button>
            {/if}
          </div>
        </div>
      {:else}
        <p class="rounded-lg border p-6 text-center text-sm text-muted-foreground">
          No requests yet.
        </p>
      {/each}
    </div>
  {/snippet}
</QueryState>
