<script lang="ts">
  import * as Field from '$lib/components/ui/field';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import FormField from '$lib/frontend/components/form/FormField.svelte';
  import OptionSelect from '$lib/frontend/components/form/OptionSelect.svelte';
  import PriceInput from '$lib/frontend/components/form/PriceInput.svelte';
  import TextArea from '$lib/frontend/components/form/TextArea.svelte';
  import TextInput from '$lib/frontend/components/form/TextInput.svelte';
  import IconButton from '$lib/frontend/components/IconButton.svelte';
  import ModalForm from '$lib/frontend/components/ModalForm.svelte';
  import type { ModalProps } from '$lib/frontend/components/utils';
  import type { Service } from '$lib/server/db/schema';
  import { CENTS_PER_DOLLAR } from '$lib/utils/billing';
  import {
    MAX_SERVICE_UPLOAD_TOTAL_MB,
    SERVICE_FIELD_TYPE,
    SERVICE_PRICING,
    type ServiceFieldType,
  } from '$lib/utils/services';
  import AlignLeftIcon from '@lucide/svelte/icons/align-left';
  import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
  import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
  import ConciergeBellIcon from '@lucide/svelte/icons/concierge-bell';
  import HashIcon from '@lucide/svelte/icons/hash';
  import ListIcon from '@lucide/svelte/icons/list';
  import PaperclipIcon from '@lucide/svelte/icons/paperclip';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import SquareCheckIcon from '@lucide/svelte/icons/square-check';
  import TrashIcon from '@lucide/svelte/icons/trash';
  import TypeIcon from '@lucide/svelte/icons/type';
  import { untrack, type Component } from 'svelte';
  import { ServiceEditor } from './service-editor.svelte';

  type Props = ModalProps & { service?: Service };

  const PRICING_OPTIONS = [
    { value: SERVICE_PRICING.FIXED, label: 'Fixed price' },
    { value: SERVICE_PRICING.VARIABLE, label: 'Quoted per request' },
  ];
  const TYPE_OPTIONS = [
    { value: SERVICE_FIELD_TYPE.TEXT, label: 'Short text' },
    { value: SERVICE_FIELD_TYPE.TEXTAREA, label: 'Long text' },
    { value: SERVICE_FIELD_TYPE.NUMBER, label: 'Number' },
    { value: SERVICE_FIELD_TYPE.SELECT, label: 'Choice' },
    { value: SERVICE_FIELD_TYPE.CHECKBOX, label: 'Checkbox' },
    { value: SERVICE_FIELD_TYPE.FILE, label: 'File upload' },
  ];
  const TYPE_ICONS: Record<ServiceFieldType, Component> = {
    [SERVICE_FIELD_TYPE.TEXT]: TypeIcon,
    [SERVICE_FIELD_TYPE.TEXTAREA]: AlignLeftIcon,
    [SERVICE_FIELD_TYPE.NUMBER]: HashIcon,
    [SERVICE_FIELD_TYPE.SELECT]: ListIcon,
    [SERVICE_FIELD_TYPE.CHECKBOX]: SquareCheckIcon,
    [SERVICE_FIELD_TYPE.FILE]: PaperclipIcon,
  };

  let { onClose, service }: Props = $props();

  // Edits a copy taken when the modal opens so list refreshes don't reset the form.
  const editor = new ServiceEditor(untrack(() => service));

  async function save() {
    if (await editor.save()) onClose();
  }
</script>

<ModalForm
  title={editor.isNew ? 'New Service' : 'Edit Service'}
  icon={ConciergeBellIcon}
  size="full"
  {onClose}
  submitLabel={editor.isNew ? 'Create Service' : 'Save Changes'}
  submitting={editor.saving}
  onSubmit={save}
  form={{ novalidate: true }}
>
  {@const nameError = editor.error('name')}
  {@const descriptionError = editor.error('description')}
  {@const listError = editor.error('fields')}
  <div class="grid gap-x-8 gap-y-6 md:grid-cols-[2fr_3fr]">
    <section class="flex flex-col gap-4 md:sticky md:top-0 md:self-start">
      <div>
        <h3 class="text-sm font-semibold">Details</h3>
        <p class="text-sm text-muted-foreground">What customers see on the services page.</p>
      </div>

      <FormField label="Name" for="service-name" required error={nameError}>
        <TextInput
          id="service-name"
          bind:value={editor.name}
          placeholder="Laser Engraving"
          aria-invalid={!!nameError}
        />
      </FormField>

      <FormField label="Description" for="service-description" required error={descriptionError}>
        <TextArea
          id="service-description"
          class="min-h-28"
          bind:value={editor.description}
          placeholder="What does this service include?"
          aria-invalid={!!descriptionError}
        />
      </FormField>

      <div class="grid grid-cols-2 gap-3">
        <FormField label="Pricing" for="service-pricing" required>
          <OptionSelect
            id="service-pricing"
            options={PRICING_OPTIONS}
            bind:value={editor.pricingMode}
          />
        </FormField>
        {#if editor.pricingMode === SERVICE_PRICING.FIXED}
          <FormField label="Price" required>
            <PriceInput bind:value={editor.price} multiplier={CENTS_PER_DOLLAR} />
          </FormField>
        {/if}
      </div>

      <Field.Field orientation="horizontal" class="rounded-lg border p-3">
        <Field.Content>
          <Field.Label for="service-enabled">Accepting requests</Field.Label>
          <Field.Description>When off, the service is hidden from customers.</Field.Description>
        </Field.Content>
        <Switch id="service-enabled" bind:checked={editor.enabled} />
      </Field.Field>
    </section>

    <section class="flex flex-col gap-3">
      <div>
        <h3 class="text-sm font-semibold">Request form</h3>
        <p class="text-sm text-muted-foreground">
          Customers always enter their name and email. Add any other questions below.
        </p>
      </div>

      {#each editor.fields as field, index (field.id)}
        {@const labelError = editor.error(`fields.${index}.label`)}
        <div class="rounded-lg border bg-card">
          <div class="flex flex-col gap-3 p-3">
            <div class="flex items-start gap-2">
              <span
                class="mt-2 flex size-5 shrink-0 items-center justify-center rounded bg-muted text-xs font-medium text-muted-foreground tabular-nums"
              >
                {index + 1}
              </span>
              <div class="flex min-w-0 flex-1 flex-col gap-1.5">
                <TextInput
                  bind:value={field.label}
                  aria-label="Question"
                  placeholder="Question, e.g. Which material?"
                  aria-invalid={!!labelError}
                />
                {#if labelError}<Field.Error>{labelError}</Field.Error>{/if}
              </div>
              <OptionSelect class="w-40 shrink-0" options={TYPE_OPTIONS} bind:value={field.type}>
                {#snippet item(option)}
                  {@const Icon = TYPE_ICONS[option.value as ServiceFieldType]}
                  <Icon class="size-4 text-muted-foreground" />
                  {option.label}
                {/snippet}
              </OptionSelect>
            </div>

            {#if field.type === SERVICE_FIELD_TYPE.SELECT}
              {@const optionsError = editor.error(`fields.${index}.options`)}
              <div class="pl-7">
                <FormField
                  label="Choices"
                  description="Separate choices with commas."
                  error={optionsError}
                >
                  <TextInput
                    bind:value={field.options}
                    placeholder="Oak, Walnut, Acrylic"
                    aria-invalid={!!optionsError}
                  />
                </FormField>
              </div>
            {:else if field.type === SERVICE_FIELD_TYPE.FILE}
              {@const typesError = editor.error(`fields.${index}.fileTypes`)}
              {@const sizeError = editor.error(`fields.${index}.maxUploadMB`)}
              <div class="grid grid-cols-[1fr_8rem] gap-3 pl-7">
                <FormField
                  label="Allowed file types"
                  description="Separate with commas. Leave blank for any file."
                  error={typesError}
                >
                  <TextInput
                    bind:value={field.fileTypes}
                    placeholder="pdf, svg, dxf"
                    aria-invalid={!!typesError}
                  />
                </FormField>
                <FormField label="Max size" error={sizeError}>
                  <div class="relative">
                    <Input
                      type="number"
                      min={1}
                      max={MAX_SERVICE_UPLOAD_TOTAL_MB}
                      class="pr-10"
                      bind:value={field.maxUploadMB}
                      aria-invalid={!!sizeError}
                    />
                    <span
                      class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground"
                    >
                      MB
                    </span>
                  </div>
                </FormField>
              </div>
            {/if}
          </div>

          <div class="flex items-center gap-2 border-t px-3 py-1.5">
            <label class="flex items-center gap-2 text-sm">
              <Switch bind:checked={field.required} />
              {field.type === SERVICE_FIELD_TYPE.CHECKBOX ? 'Must be checked' : 'Required'}
            </label>
            <div class="ml-auto flex items-center">
              <IconButton
                icon={ArrowUpIcon}
                aria-label="Move up"
                disabled={index === 0}
                onclick={() => editor.moveField(index, -1)}
              />
              <IconButton
                icon={ArrowDownIcon}
                aria-label="Move down"
                disabled={index === editor.fields.length - 1}
                onclick={() => editor.moveField(index, 1)}
              />
              <IconButton
                icon={TrashIcon}
                aria-label="Remove question"
                class="text-destructive"
                onclick={() => editor.removeField(index)}
              />
            </div>
          </div>
        </div>
      {/each}

      {#if listError}<Field.Error>{listError}</Field.Error>{/if}

      <button
        type="button"
        class="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed text-sm text-muted-foreground transition-colors hover:border-primary/70 hover:text-foreground focus-visible:border-ring focus-visible:outline-none"
        onclick={() => editor.addField()}
      >
        <PlusIcon class="size-4" />
        Add question
      </button>
    </section>
  </div>
</ModalForm>
