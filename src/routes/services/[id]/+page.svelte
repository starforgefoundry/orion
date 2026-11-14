<script lang="ts">
  import { page } from '$app/state';
  import { Button } from '$lib/components/ui/button';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import * as Field from '$lib/components/ui/field';
  import { Spinner } from '$lib/components/ui/spinner';
  import FileDropArea from '$lib/frontend/components/FileDropArea.svelte';
  import IconButton from '$lib/frontend/components/IconButton.svelte';
  import FormField, { describedBy } from '$lib/frontend/components/form/FormField.svelte';
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
  import { formatCents } from '$lib/utils/billing';
  import {
    fileTypeList,
    fileUploadLimitMB,
    SERVICE_FIELD_TYPE,
    SERVICE_PRICING,
    type ServiceField,
  } from '$lib/utils/services';
  import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
  import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
  import FileIcon from '@lucide/svelte/icons/file';
  import FilePlusIcon from '@lucide/svelte/icons/file-plus';
  import TrashIcon from '@lucide/svelte/icons/trash';
  import { tick } from 'svelte';
  import {
    answerInputId,
    EMAIL_ID,
    NAME_ID,
    ServiceRequestForm,
  } from './service-request-form.svelte';

  const serviceId = $derived(page.params.id ?? '');
  const serviceQuery = $derived(getEnabledService(serviceId));
  const requestForm = $derived(submitServiceRequestForm.for(serviceId));
  const manager = $derived(new ServiceRequestForm(requestForm));
  const pageTitle = $derived(
    requestForm.result ? 'Request received' : (serviceQuery.current?.name ?? 'Service'),
  );

  const EMAIL_DESCRIPTION = "We'll send updates about your request here.";
  const REFERENCE_LENGTH = 8;

  function fileHint(field: ServiceField) {
    const limit = `up to ${fileUploadLimitMB(field)} MB.`;
    return field.fileTypes?.length
      ? `Accepts ${fileTypeList(field.fileTypes)}, ${limit}`
      : `Any file type, ${limit}`;
  }

  /** A short id customers can quote to staff. */
  function requestReference(id: string) {
    return id.slice(0, REFERENCE_LENGTH).toUpperCase();
  }
</script>

<svelte:head>
  <title>{pageTitle} | Starforge Services</title>
</svelte:head>

<div class="mx-auto flex max-w-xl flex-col gap-4">
  {#if !requestForm.result}
    <a
      href="/services"
      class="flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeftIcon class="size-4" /> Back to services
    </a>
  {/if}

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
        {@const variable = result.pricingMode === SERVICE_PRICING.VARIABLE}
        <div
          class="flex flex-col items-center gap-2 rounded-xl border bg-card p-8 text-center"
          role="status"
        >
          <CircleCheckIcon class="size-10 text-green-600" aria-hidden="true" />
          <h2
            class="text-lg font-semibold outline-none"
            tabindex="-1"
            {@attach (heading) => heading.focus()}
          >
            {service.name} request received
          </h2>
          <p class="text-sm">
            Reference: <span class="font-mono font-medium">{requestReference(result.id)}</span>
          </p>
          <p class="text-sm text-muted-foreground">
            {#if variable}
              Staff will review it and email a quote to <strong>{result.email}</strong>. There is
              nothing to pay now.
            {:else if result.price > 0}
              Your request starts once it is paid. Staff will contact you at
              <strong>{result.email}</strong> with updates.
            {:else}
              There is nothing to pay. Staff will contact you at <strong>{result.email}</strong>
              with updates.
            {/if}
          </p>
          <div class="mt-2 flex flex-wrap justify-center gap-2">
            {#if !variable && result.price > 0}
              <Button href="/pay/{result.paymentId}">Pay {formatCents(result.price)} now</Button>
            {/if}
            <Button variant="outline" href="/services">Back to services</Button>
          </div>
        </div>
      {:else}
        <form
          class="flex flex-col gap-4 rounded-xl border bg-card p-5 sm:p-6"
          enctype="multipart/form-data"
          novalidate
          oninput={(event) => manager.edited(event)}
          {...enhanceForm(requestForm, {
            validate: () => manager.validate(service.fields),
            onIssue: (message) => (manager.submitError = message),
            onError: (cause) =>
              (manager.submitError = errorDescription(cause) || 'Something went wrong. Try again.'),
            onSuccess: () => (manager.submitError = ''),
          })}
        >
          <input {...requestForm.fields.serviceId.as('hidden', service.id)} />

          <div>
            <h2 class="text-xl font-semibold">{service.name}</h2>
            <p class="mt-1 text-sm whitespace-pre-line text-muted-foreground">
              {service.description}
            </p>
            <p class="mt-2 text-sm font-medium">
              {#if service.pricingMode === SERVICE_PRICING.VARIABLE}
                Free quote — you won't pay until staff send a price.
              {:else if service.price > 0}
                Price: {formatCents(service.price)}
              {:else}
                Price: Free
              {/if}
            </p>
          </div>

          <FormField label="Your Name" for={NAME_ID} required error={manager.nameError}>
            <TextInput
              id={NAME_ID}
              {...requestForm.fields.customerName.as('text')}
              placeholder="John Doe"
              autocomplete="name"
              required
              aria-invalid={!!manager.nameError}
              aria-describedby={describedBy(NAME_ID, { error: manager.nameError })}
            />
          </FormField>
          <FormField
            label="Email"
            for={EMAIL_ID}
            required
            description={EMAIL_DESCRIPTION}
            error={manager.emailError}
          >
            <TextInput
              id={EMAIL_ID}
              {...requestForm.fields.email.as('email')}
              placeholder="john@example.com"
              autocomplete="email"
              spellcheck={false}
              required
              aria-invalid={!!manager.emailError}
              aria-describedby={describedBy(EMAIL_ID, {
                description: EMAIL_DESCRIPTION,
                error: manager.emailError,
              })}
            />
          </FormField>

          {#each service.fields as field (field.id)}
            {@const id = answerInputId(field)}
            {@const answer = requestForm.fields.answers[field.id]}
            {@const error = manager.answerError(field)}
            {@const description =
              field.type === SERVICE_FIELD_TYPE.FILE ? fileHint(field) : undefined}
            {@const aria = {
              'aria-required': field.required,
              'aria-invalid': !!error,
              'aria-describedby': describedBy(id, { description, error }),
            }}
            {#if field.type === SERVICE_FIELD_TYPE.CHECKBOX}
              <div class="flex flex-col gap-1.5">
                <Field.Field orientation="horizontal" data-invalid={error ? true : undefined}>
                  <Checkbox
                    {id}
                    checked={manager.checks[field.id] ?? false}
                    onCheckedChange={(checked) => manager.check(field, checked)}
                    required={field.required}
                    {...aria}
                  />
                  <Field.Label for={id} class="font-normal">
                    {field.label}
                    {#if field.required}
                      <span class="text-destructive" aria-hidden="true">*</span>
                    {/if}
                  </Field.Label>
                  <HiddenField field={answer} value={manager.checks[field.id] ?? false} />
                </Field.Field>
                {#if error}<Field.Error id="{id}-error">{error}</Field.Error>{/if}
              </div>
            {:else}
              <FormField
                label={field.label}
                for={id}
                required={field.required}
                {description}
                {error}
              >
                {#if field.type === SERVICE_FIELD_TYPE.TEXTAREA}
                  <TextArea {id} {...answer.as('text')} required={field.required} {...aria} />
                {:else if field.type === SERVICE_FIELD_TYPE.SELECT}
                  <OptionSelect
                    {id}
                    options={[...new Set(field.options)].map((option) => ({
                      value: option,
                      label: option,
                    }))}
                    value={manager.choices[field.id] ?? ''}
                    onValueChange={(value) => manager.choose(field, value)}
                    placeholder="Choose one"
                    {...aria}
                  />
                  <HiddenField field={answer} value={manager.choices[field.id] ?? ''} />
                {:else if field.type === SERVICE_FIELD_TYPE.FILE}
                  {@const file = answer.value()}
                  {#if file instanceof File}
                    <!-- Carries the picked file. Removed with it, since setting the field does not clear the input. -->
                    <input {...answer.as('file')} hidden />
                    <!-- Keeps the id the label and error focus point at while the drop button is gone. -->
                    <div
                      {id}
                      class="flex items-center gap-2 rounded-lg border p-2 pl-3 outline-none"
                      role="group"
                      tabindex="-1"
                      aria-labelledby="{id}-label"
                      aria-describedby={aria['aria-describedby']}
                    >
                      <FileIcon class="size-5 shrink-0 text-muted-foreground" />
                      <div class="min-w-0 flex-1">
                        <p class="truncate text-sm font-medium">{file.name}</p>
                        <p class="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                      </div>
                      <IconButton
                        icon={TrashIcon}
                        aria-label="Remove file"
                        class="text-destructive"
                        onclick={async () => {
                          manager.removeFile(field);
                          await tick();
                          document.getElementById(id)?.focus();
                        }}
                      />
                    </div>
                  {:else}
                    <FileDropArea
                      onUpload={(upload) => manager.pickFile(field, upload)}
                      onUnsupported={(upload) => manager.pickFile(field, upload)}
                      supportedExtensions={field.fileTypes?.length ? field.fileTypes : undefined}
                      multiple={false}
                      label={`${field.label}: drop a file here`}
                      class="rounded-lg"
                    >
                      {#snippet children({ open })}
                        <!-- Buttons can't take aria-required or aria-invalid, so the name says required and data-invalid styles errors. -->
                        <button
                          {id}
                          type="button"
                          class="flex w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors hover:border-primary/70 hover:bg-muted/30 focus-visible:border-ring focus-visible:outline-none data-invalid:border-destructive"
                          onclick={open}
                          aria-label={`${field.label}: click to upload${field.required ? ' (required)' : ''}`}
                          aria-describedby={aria['aria-describedby']}
                          data-invalid={error ? true : undefined}
                        >
                          <FilePlusIcon class="mb-1 size-8 text-muted-foreground" />
                          <span class="text-sm">
                            <span class="font-medium">Click to upload</span>
                            <span class="text-muted-foreground pointer-coarse:hidden">
                              or drag and drop
                            </span>
                          </span>
                        </button>
                      {/snippet}
                    </FileDropArea>
                  {/if}
                {:else if field.type === SERVICE_FIELD_TYPE.NUMBER}
                  <!-- Sent as text so an empty optional number is '' rather than undefined. -->
                  <TextInput
                    {id}
                    {...answer.as('text')}
                    type="number"
                    step="any"
                    required={field.required}
                    {...aria}
                  />
                {:else}
                  <TextInput {id} {...answer.as('text')} required={field.required} {...aria} />
                {/if}
              </FormField>
            {/if}
          {/each}

          {#if manager.submitError}
            <p class="text-sm text-destructive" role="alert">{manager.submitError}</p>
          {/if}

          <Button type="submit" disabled={requestForm.pending > 0}>
            {#if requestForm.pending > 0}<Spinner />{/if}
            {service.pricingMode === SERVICE_PRICING.FIXED ? 'Submit Request' : 'Request a Quote'}
          </Button>
        </form>
      {/if}
    {/snippet}
  </QueryState>
</div>
