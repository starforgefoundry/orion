<script lang="ts">
  import { page } from '$app/state';
  import { Button } from '$lib/components/ui/button';
  import { Spinner } from '$lib/components/ui/spinner';
  import { Switch } from '$lib/components/ui/switch';
  import FormField from '$lib/frontend/components/form/FormField.svelte';
  import HiddenField from '$lib/frontend/components/form/HiddenField.svelte';
  import OptionSelect from '$lib/frontend/components/form/OptionSelect.svelte';
  import TextArea from '$lib/frontend/components/form/TextArea.svelte';
  import TextInput from '$lib/frontend/components/form/TextInput.svelte';
  import QueryState from '$lib/frontend/components/QueryState.svelte';
  import { enhanceForm, errorDescription } from '$lib/frontend/form-submit';
  import {
    getEnabledService,
    submitServiceRequestForm,
  } from '$lib/remotes/endpoints/service.remote';
  import { formatCents } from '$lib/utils/billing';
  import { MAX_SERVICE_UPLOAD_MB, SERVICE_FIELD_TYPE, SERVICE_PRICING } from '$lib/utils/services';
  import CircleCheckIcon from '@lucide/svelte/icons/circle-check';

  const serviceId = $derived(page.params.id ?? '');
  const serviceQuery = $derived(getEnabledService(serviceId));
  const requestForm = $derived(submitServiceRequestForm.for(serviceId));

  // Selects and switches hold their value here; HiddenField puts it in the form.
  let choices = $state<Record<string, string>>({});
  let checks = $state<Record<string, boolean>>({});
  let error = $state('');
</script>

<svelte:head>
  <title>{serviceQuery.current?.name ?? 'Service'} | Starforge Services</title>
</svelte:head>

<QueryState query={serviceQuery} label="service">
  {#snippet pending()}
    <Spinner class="mx-auto mt-12 size-8" />
  {/snippet}
  {#snippet children(service)}
    {#if !service}
      <p class="rounded-lg border p-6 text-center text-sm text-muted-foreground">
        This service is not available.
      </p>
    {:else if requestForm.result}
      {@const result = requestForm.result}
      <div class="flex flex-col items-center gap-2 rounded-lg border p-8 text-center" role="status">
        <CircleCheckIcon class="size-10 text-green-600" aria-hidden="true" />
        <h2 class="text-lg font-semibold">Request received</h2>
        <p class="text-sm text-muted-foreground">
          {#if result.pricingMode === SERVICE_PRICING.FIXED && result.price !== null}
            The price is {formatCents(result.price)}. Staff will contact you by email.
          {:else}
            Staff will review your request and email you a quote.
          {/if}
        </p>
        <Button variant="outline" href="/services" class="mt-2">Back to Services</Button>
      </div>
    {:else}
      <form
        class="mx-auto flex max-w-xl flex-col gap-4"
        enctype="multipart/form-data"
        {...enhanceForm(requestForm, {
          onIssue: (message) => (error = message),
          onError: (cause) =>
            (error = errorDescription(cause) || 'Something went wrong. Try again.'),
          onSuccess: () => (error = ''),
        })}
      >
        <input {...requestForm.fields.serviceId.as('hidden', service.id)} />

        <div>
          <h2 class="text-xl font-semibold">{service.name}</h2>
          <p class="mt-1 text-sm whitespace-pre-line text-muted-foreground">
            {service.description}
          </p>
          <p class="mt-2 text-sm font-medium">
            {service.pricingMode === SERVICE_PRICING.FIXED
              ? formatCents(service.price)
              : 'Quote after review'}
          </p>
        </div>

        <FormField label="Your Name" for="customer-name" required>
          <TextInput
            id="customer-name"
            {...requestForm.fields.customerName.as('text')}
            autocomplete="name"
            required
          />
        </FormField>
        <FormField label="Email" for="customer-email" required>
          <TextInput
            id="customer-email"
            {...requestForm.fields.email.as('email')}
            autocomplete="email"
            spellcheck={false}
            required
          />
        </FormField>

        {#each service.fields as field (field.id)}
          {@const id = `answer-${field.id}`}
          {@const answer = requestForm.fields.answers[field.id]}
          {#if field.type === SERVICE_FIELD_TYPE.CHECKBOX}
            <div class="flex items-center gap-2">
              <Switch
                {id}
                checked={checks[field.id] ?? false}
                onCheckedChange={(checked) => (checks[field.id] = checked)}
              />
              <label for={id} class="text-sm">
                {field.label}
                {#if field.required}<span class="text-destructive">*</span>{/if}
              </label>
              <HiddenField field={answer} value={checks[field.id] ?? false} />
            </div>
          {:else}
            <FormField
              label={field.label}
              for={id}
              required={field.required}
              description={field.type === SERVICE_FIELD_TYPE.FILE
                ? `Up to ${MAX_SERVICE_UPLOAD_MB} MB.`
                : undefined}
            >
              {#if field.type === SERVICE_FIELD_TYPE.TEXTAREA}
                <TextArea {id} {...answer.as('text')} required={field.required} />
              {:else if field.type === SERVICE_FIELD_TYPE.SELECT}
                <OptionSelect
                  {id}
                  options={field.options.map((option) => ({ value: option, label: option }))}
                  value={choices[field.id] ?? ''}
                  onValueChange={(value) => (choices[field.id] = value)}
                  placeholder="Choose one"
                />
                <HiddenField field={answer} value={choices[field.id] ?? ''} />
              {:else if field.type === SERVICE_FIELD_TYPE.FILE}
                <input {id} {...answer.as('file')} class="text-sm" required={field.required} />
              {:else if field.type === SERVICE_FIELD_TYPE.NUMBER}
                <!-- Sent as text so an empty optional number is '' rather than undefined. -->
                <TextInput
                  {id}
                  {...answer.as('text')}
                  type="number"
                  step="any"
                  required={field.required}
                />
              {:else}
                <TextInput {id} {...answer.as('text')} required={field.required} />
              {/if}
            </FormField>
          {/if}
        {/each}

        {#if error}<p class="text-sm text-destructive" role="alert">{error}</p>{/if}

        <Button type="submit" disabled={requestForm.pending > 0}>
          {#if requestForm.pending > 0}<Spinner />{/if}
          {service.pricingMode === SERVICE_PRICING.FIXED ? 'Submit Request' : 'Request a Quote'}
        </Button>
      </form>
    {/if}
  {/snippet}
</QueryState>
