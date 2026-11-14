<script lang="ts">
  import { page } from '$app/state';
  import { Button } from '$lib/components/ui/button';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import * as Field from '$lib/components/ui/field';
  import { Spinner } from '$lib/components/ui/spinner';
  import FileDropArea from '$lib/frontend/components/FileDropArea.svelte';
  import FileUploadPrompt from '$lib/frontend/components/FileUploadPrompt.svelte';
  import IconButton from '$lib/frontend/components/IconButton.svelte';
  import StepProgress from '$lib/frontend/components/StepProgress.svelte';
  import { cn } from '$lib/frontend/cn';
  import FormField from '$lib/frontend/components/form/FormField.svelte';
  import HiddenField from '$lib/frontend/components/form/HiddenField.svelte';
  import OptionSelect from '$lib/frontend/components/form/OptionSelect.svelte';
  import TextArea from '$lib/frontend/components/form/TextArea.svelte';
  import TextInput from '$lib/frontend/components/form/TextInput.svelte';
  import QueryState from '$lib/frontend/components/QueryState.svelte';
  import { enhanceForm, errorDescription } from '$lib/frontend/form-submit';
  import { formatBytes } from '$lib/frontend/format';
  import {
    getEnabledService,
    submitServiceRequestForm,
  } from '$lib/remotes/endpoints/service.remote';
  import { serviceRequestSchema } from '$lib/remotes/dtos/service.dto';
  import { formatCents } from '$lib/utils/billing';
  import {
    fileTypeList,
    fileUploadLimitMB,
    SERVICE_FIELD_TYPE,
    SERVICE_PRICING,
    type ServiceField,
  } from '$lib/utils/services';
  import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
  import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
  import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
  import FileIcon from '@lucide/svelte/icons/file';
  import TrashIcon from '@lucide/svelte/icons/trash';
  import type { RemoteFormIssue } from '@sveltejs/kit';
  import { ServiceRequestForm, STEPS } from './service-request-form.svelte';

  const STEP_LIST = [
    { id: STEPS.CONTACT, label: 'Your Info' },
    { id: STEPS.DETAILS, label: 'Request Details' },
  ];

  const serviceId = $derived(page.params.id ?? '');
  const serviceQuery = $derived(getEnabledService(serviceId));
  const requestForm = $derived(submitServiceRequestForm.for(serviceId));
  // Rebuilt per service so answers and the step don't carry over between services.
  const manager = $derived.by(() => {
    const form = submitServiceRequestForm.for(serviceId);
    return new ServiceRequestForm(() => form);
  });

  function issue(field: { issues(): RemoteFormIssue[] | undefined }) {
    return field.issues()?.[0]?.message;
  }

  function priceLabel(service: { pricingMode: string; price: number }) {
    if (service.pricingMode === SERVICE_PRICING.VARIABLE) return 'Quoted after review';
    return service.price > 0 ? formatCents(service.price) : 'Free';
  }

  function fileHint(field: ServiceField) {
    const types = field.fileTypes?.length ? fileTypeList(field.fileTypes) : 'Any file type';
    return `${types} · up to ${fileUploadLimitMB(field)} MB`;
  }
</script>

<svelte:head>
  <title>{serviceQuery.current?.name ?? 'Service'} | Starforge Services</title>
</svelte:head>

{#key serviceId}
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
        <div
          class="flex flex-col items-center gap-2 rounded-xl border bg-card p-8 text-center"
          role="status"
        >
          <CircleCheckIcon class="size-10 text-green-600" aria-hidden="true" />
          <h2 class="text-lg font-semibold">Request received</h2>
          <p class="text-sm text-muted-foreground">
            {#if result.pricingMode === SERVICE_PRICING.VARIABLE}
              Staff will review your request and send you a quote.
            {:else if result.price > 0}
              The price is {formatCents(result.price)}.
            {:else}
              There is nothing to pay.
            {/if}
          </p>
          <div class="mt-2 flex flex-wrap justify-center gap-2">
            {#if result.pricingMode === SERVICE_PRICING.FIXED && result.price > 0}
              <Button href="/pay/{result.paymentId}">Pay Now</Button>
            {/if}
            <Button variant="outline" href="/services">Back to Services</Button>
          </div>
        </div>
      {:else}
        {@const hasDetails = service.fields.length > 0}
        <form
          class="flex flex-col gap-6"
          enctype="multipart/form-data"
          novalidate
          onsubmitcapture={() => manager.submitting()}
          oninput={() => manager.edited()}
          {...enhanceForm(requestForm.preflight(serviceRequestSchema(service.fields)), {
            onIssue: (message) => (manager.error = message),
            onError: (cause) =>
              (manager.error = errorDescription(cause) || 'Something went wrong. Try again.'),
            onSuccess: () => (manager.error = ''),
          })}
        >
          <input {...requestForm.fields.serviceId.as('hidden', service.id)} />

          <header class="flex flex-col gap-2">
            <a
              href="/services"
              class="flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeftIcon class="size-4" /> All services
            </a>
            <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 class="text-2xl font-semibold">{service.name}</h2>
              <span class="text-base font-medium">{priceLabel(service)}</span>
            </div>
            <p class="text-sm whitespace-pre-line text-muted-foreground">{service.description}</p>
          </header>

          {#snippet submitButton()}
            <Button type="submit" size="lg" disabled={requestForm.pending > 0}>
              {#if requestForm.pending > 0}<Spinner />{/if}
              {service.pricingMode === SERVICE_PRICING.FIXED ? 'Submit Request' : 'Request a Quote'}
            </Button>
          {/snippet}

          {#snippet errorMessage()}
            {#if manager.error}
              <p class="text-sm text-destructive" role="alert">{manager.error}</p>
            {/if}
          {/snippet}

          {#if hasDetails}
            <StepProgress steps={STEP_LIST} current={manager.step} />
          {/if}

          <!-- Both steps live in one form (step 1 is only hidden) so every field is submitted. -->
          <section
            class={cn(
              'flex flex-col gap-4 rounded-xl border bg-card p-5 sm:p-6',
              manager.step !== STEPS.CONTACT && 'hidden',
            )}
          >
            <h3 class="text-base font-semibold">Your Info</h3>
            <div class="grid gap-4 sm:grid-cols-2">
              <FormField
                label="Name"
                for="customer-name"
                required
                error={issue(requestForm.fields.customerName)}
              >
                <TextInput
                  id="customer-name"
                  {...requestForm.fields.customerName.as('text')}
                  placeholder="John Doe"
                  autocomplete="name"
                  onkeydown={(event) => hasDetails && manager.contactKeydown(event)}
                  required
                />
              </FormField>
              <FormField
                label="Email"
                for="customer-email"
                required
                error={issue(requestForm.fields.email)}
              >
                <TextInput
                  id="customer-email"
                  {...requestForm.fields.email.as('email')}
                  placeholder="john@example.com"
                  autocomplete="email"
                  onkeydown={(event) => hasDetails && manager.contactKeydown(event)}
                  spellcheck={false}
                  required
                />
              </FormField>
            </div>
            <p class="text-sm text-muted-foreground">We'll email you updates about your request.</p>
            {#if hasDetails}
              <Button
                size="lg"
                class="mt-2 sm:self-end"
                disabled={!manager.contactValid}
                onclick={() => manager.next()}
              >
                Continue
                <ArrowRightIcon />
              </Button>
            {:else}
              {@render errorMessage()}
              <div class="mt-2 flex sm:justify-end">{@render submitButton()}</div>
            {/if}
          </section>

          {#if hasDetails}
            <div class={cn('flex flex-col gap-6', manager.step !== STEPS.DETAILS && 'hidden')}>
              <section class="flex flex-col gap-5 rounded-xl border bg-card p-5 sm:p-6">
                <h3 class="text-base font-semibold">Request Details</h3>
                {#each service.fields as field (field.id)}
                  {@const id = `answer-${field.id}`}
                  {@const answer = requestForm.fields.answers[field.id]}
                  {@const answerError = issue(answer)}
                  {#if field.type === SERVICE_FIELD_TYPE.CHECKBOX}
                    <Field.Field
                      orientation="horizontal"
                      data-invalid={answerError ? true : undefined}
                    >
                      <Checkbox
                        {id}
                        checked={manager.checks[field.id] ?? false}
                        onCheckedChange={(checked) => manager.check(field, checked)}
                      />
                      <Field.Label for={id} class="font-normal">
                        {field.label}
                        {#if field.required}<span class="text-destructive">*</span>{/if}
                      </Field.Label>
                      <HiddenField field={answer} value={manager.checks[field.id] ?? false} />
                    </Field.Field>
                    {#if answerError}<Field.Error>{answerError}</Field.Error>{/if}
                  {:else}
                    <FormField
                      label={field.label}
                      for={id}
                      required={field.required}
                      error={answerError}
                    >
                      {#if field.type === SERVICE_FIELD_TYPE.TEXTAREA}
                        <TextArea {id} {...answer.as('text')} required={field.required} />
                      {:else if field.type === SERVICE_FIELD_TYPE.SELECT}
                        <OptionSelect
                          {id}
                          options={field.options.map((option) => ({
                            value: option,
                            label: option,
                          }))}
                          value={manager.choices[field.id] ?? ''}
                          onValueChange={(value) => manager.choose(field, value)}
                          placeholder="Choose one"
                        />
                        <HiddenField field={answer} value={manager.choices[field.id] ?? ''} />
                      {:else if field.type === SERVICE_FIELD_TYPE.FILE}
                        {@const file = manager.files[field.id]}
                        {#if file}
                          <div class="flex items-center gap-2 rounded-lg border p-2 pl-3">
                            <FileIcon class="size-5 shrink-0 text-muted-foreground" />
                            <div class="min-w-0 flex-1">
                              <p class="truncate text-sm font-medium">{file.name}</p>
                              <p class="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                            </div>
                            <IconButton
                              icon={TrashIcon}
                              aria-label="Remove file"
                              class="text-destructive"
                              onclick={() => manager.removeFile(field)}
                            />
                          </div>
                        {:else}
                          <FileDropArea
                            onUpload={(upload) => manager.pickFile(field, upload)}
                            onUnsupported={(upload) => manager.pickFile(field, upload)}
                            supportedExtensions={field.fileTypes?.length
                              ? field.fileTypes
                              : undefined}
                            multiple={false}
                            class="rounded-lg"
                          >
                            {#snippet children({ open })}
                              <FileUploadPrompt
                                {id}
                                class="w-full"
                                onclick={open}
                                hint={fileHint(field)}
                                invalid={!!answerError}
                              />
                            {/snippet}
                          </FileDropArea>
                        {/if}
                        <HiddenField field={answer} value={file ?? ''} />
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
              </section>

              {@render errorMessage()}

              <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                <Button variant="outline" size="lg" onclick={() => manager.back()}>
                  <ArrowLeftIcon />
                  Back
                </Button>
                {@render submitButton()}
              </div>
            </div>
          {/if}
        </form>
      {/if}
    {/snippet}
  </QueryState>
{/key}
