<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import * as Field from '$lib/components/ui/field';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import FormField, { describedBy } from '$lib/frontend/components/form/FormField.svelte';
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
    MAX_SERVICE_UPLOAD_LIMIT_MB,
    SERVICE_FIELD_TYPE,
    SERVICE_PRICING,
  } from '$lib/utils/services';
  import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
  import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
  import ConciergeBellIcon from '@lucide/svelte/icons/concierge-bell';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import TrashIcon from '@lucide/svelte/icons/trash';
  import { untrack } from 'svelte';
  import {
    ADD_FIELD_ID,
    fieldInputId,
    ServiceEditor,
    type EditableField,
  } from './service-editor.svelte';

  type Props = ModalProps & { service?: Service };

  const PRICING_OPTIONS = [
    { value: SERVICE_PRICING.FIXED, label: 'Fixed price' },
    { value: SERVICE_PRICING.VARIABLE, label: 'Variable (quoted per request)' },
  ];
  const TYPE_OPTIONS = [
    { value: SERVICE_FIELD_TYPE.TEXT, label: 'Short text' },
    { value: SERVICE_FIELD_TYPE.TEXTAREA, label: 'Long text' },
    { value: SERVICE_FIELD_TYPE.NUMBER, label: 'Number' },
    { value: SERVICE_FIELD_TYPE.SELECT, label: 'Choice' },
    { value: SERVICE_FIELD_TYPE.CHECKBOX, label: 'Checkbox' },
    { value: SERVICE_FIELD_TYPE.FILE, label: 'File upload' },
  ];

  // The trigger's label hides its text, so the label also names the chosen type.
  const TYPE_LABELS = Object.fromEntries(
    TYPE_OPTIONS.map((option) => [option.value, option.label]),
  );

  let { onClose, service }: Props = $props();

  // Edits a copy taken when the modal opens so list refreshes don't reset the form.
  const editor = new ServiceEditor(untrack(() => service));

  async function save() {
    if (await editor.save()) onClose();
  }

  /** Names a field in button labels, e.g. `“Material”` or `field 2`. */
  function fieldName(field: EditableField, index: number) {
    const label = field.label.trim();
    return label ? `“${label}”` : `field ${index + 1}`;
  }

  // Enter in a field's inputs would submit and close the modal mid-edit.
  function preventEnterSubmit(event: KeyboardEvent) {
    if (event.key === 'Enter' && event.target instanceof HTMLInputElement) event.preventDefault();
  }

  // Leaving a field card shows its errors; focus inside the card does not.
  function leaveField(event: FocusEvent, field: EditableField) {
    const card = event.currentTarget as HTMLElement;
    if (!card.contains(event.relatedTarget as Node | null)) editor.checkField(field);
  }
</script>

<ModalForm
  title={editor.isNew ? 'New Service' : 'Edit Service'}
  icon={ConciergeBellIcon}
  {onClose}
  submitLabel={editor.isNew ? 'Create Service' : 'Save Changes'}
  submitting={editor.saving}
  onSubmit={save}
  form={{ novalidate: true }}
>
  {@const nameError = editor.error('name')}
  {@const descriptionError = editor.error('description')}
  <FormField label="Service Name" for="service-name" required error={nameError}>
    <TextInput
      id="service-name"
      bind:value={editor.name}
      placeholder="Laser Engraving"
      aria-invalid={!!nameError}
      aria-describedby={describedBy('service-name', { error: nameError })}
    />
  </FormField>

  <FormField label="Description" for="service-description" required error={descriptionError}>
    <TextArea
      id="service-description"
      bind:value={editor.description}
      placeholder="What does this service include?"
      aria-invalid={!!descriptionError}
      aria-describedby={describedBy('service-description', { error: descriptionError })}
    />
  </FormField>

  <FormField
    label="Pricing"
    for="service-pricing"
    required
    description={editor.pricingMode === SERVICE_PRICING.VARIABLE
      ? "You'll quote each request from the queue."
      : undefined}
  >
    <OptionSelect
      id="service-pricing"
      options={PRICING_OPTIONS}
      bind:value={editor.pricingMode}
      aria-describedby={describedBy('service-pricing', {
        description: editor.pricingMode === SERVICE_PRICING.VARIABLE,
      })}
    />
  </FormField>

  {#if editor.pricingMode === SERVICE_PRICING.FIXED}
    {@const description = 'Set $0.00 for a free service.'}
    <FormField label="Price" for="service-price" required {description}>
      <PriceInput
        id="service-price"
        bind:value={editor.price}
        multiplier={CENTS_PER_DOLLAR}
        aria-describedby={describedBy('service-price', { description })}
      />
    </FormField>
  {/if}

  <Field.Field orientation="horizontal">
    <Field.Content>
      <Field.Label for="service-enabled">Accepting requests</Field.Label>
      <Field.Description id="service-enabled-description">
        When off, the service is hidden from the services page and its form says it is not
        available.
      </Field.Description>
    </Field.Content>
    <Switch
      id="service-enabled"
      bind:checked={editor.enabled}
      aria-describedby="service-enabled-description"
    />
  </Field.Field>

  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="flex flex-col gap-2"
    role="group"
    aria-labelledby="service-fields-label"
    aria-describedby="service-fields-description"
    onkeydown={preventEnterSubmit}
  >
    <span id="service-fields-label" class="text-sm font-medium">Request form fields</span>
    <p id="service-fields-description" class="text-sm text-muted-foreground">
      Customers always give their name and email.
    </p>
    {#each editor.fields as field, index (field.id)}
      {@const name = fieldName(field, index)}
      {@const labelId = fieldInputId(field, 'label')}
      {@const labelError = editor.error(`fields.${index}.label`)}
      {@const requiredId = `field-${field.id}-required`}
      <div
        class="flex flex-col gap-2 rounded-lg border p-3"
        role="group"
        aria-label={`Field ${index + 1}`}
        onfocusout={(event) => leaveField(event, field)}
      >
        <div class="flex flex-col gap-2 sm:flex-row">
          <TextInput
            id={labelId}
            class="sm:flex-1"
            bind:value={field.label}
            aria-label="Field label"
            placeholder="Question or label"
            aria-invalid={!!labelError}
            aria-describedby={labelError ? `${labelId}-error` : undefined}
            onkeydown={(event) => event.key === 'Enter' && editor.nextLabel(index)}
          />
          <div class="flex gap-1">
            <OptionSelect
              class="flex-1 sm:w-36"
              options={TYPE_OPTIONS}
              bind:value={field.type}
              onValueChange={() => editor.checkField(field, false)}
              aria-label={`Field type: ${TYPE_LABELS[field.type]}`}
            />
            <IconButton
              id={fieldInputId(field, 'up')}
              icon={ArrowUpIcon}
              aria-label={`Move ${name} up`}
              disabled={index === 0}
              onclick={() => editor.moveField(index, -1)}
            />
            <IconButton
              id={fieldInputId(field, 'down')}
              icon={ArrowDownIcon}
              aria-label={`Move ${name} down`}
              disabled={index === editor.fields.length - 1}
              onclick={() => editor.moveField(index, 1)}
            />
            <IconButton
              icon={TrashIcon}
              aria-label={`Remove ${name}`}
              onclick={() => editor.removeField(index)}
            />
          </div>
        </div>
        {#if labelError}
          <Field.Error id={`${labelId}-error`}>{labelError}</Field.Error>
        {/if}
        {#if field.type === SERVICE_FIELD_TYPE.SELECT}
          {@const id = fieldInputId(field, 'options')}
          {@const error = editor.error(`fields.${index}.options`)}
          {@const description = 'Separate choices with commas.'}
          <FormField label="Choices" for={id} {description} {error}>
            <TextInput
              {id}
              bind:value={field.options}
              placeholder="Oak, Walnut, Acrylic"
              aria-invalid={!!error}
              aria-describedby={describedBy(id, { description, error })}
            />
          </FormField>
        {:else if field.type === SERVICE_FIELD_TYPE.FILE}
          {@const typesId = fieldInputId(field, 'fileTypes')}
          {@const typesError = editor.error(`fields.${index}.fileTypes`)}
          {@const sizeId = fieldInputId(field, 'maxUploadMB')}
          {@const sizeError = editor.error(`fields.${index}.maxUploadMB`)}
          {@const typesDescription =
            'Extensions separated by commas. Leave blank to allow any file.'}
          <div class="flex flex-col gap-2 sm:flex-row sm:items-start">
            <FormField
              label="Allowed types"
              for={typesId}
              description={typesDescription}
              error={typesError}
              class="sm:flex-1"
            >
              <TextInput
                id={typesId}
                bind:value={field.fileTypes}
                placeholder="pdf, svg"
                aria-invalid={!!typesError}
                aria-describedby={describedBy(typesId, {
                  description: typesDescription,
                  error: typesError,
                })}
              />
            </FormField>
            <FormField label="Max size (MB)" for={sizeId} error={sizeError} class="sm:w-32">
              <Input
                id={sizeId}
                type="number"
                min={1}
                max={MAX_SERVICE_UPLOAD_LIMIT_MB}
                bind:value={field.maxUploadMB}
                aria-invalid={!!sizeError}
                aria-describedby={describedBy(sizeId, { error: sizeError })}
              />
            </FormField>
          </div>
        {/if}
        <div class="flex items-center gap-2">
          <Switch id={requiredId} bind:checked={field.required} />
          <label for={requiredId} class="text-sm">Required</label>
        </div>
      </div>
    {:else}
      <p class="text-sm text-muted-foreground">No extra fields yet.</p>
    {/each}
    <Button
      id={ADD_FIELD_ID}
      variant="outline"
      size="sm"
      class="self-start"
      onclick={() => editor.addField()}
    >
      <PlusIcon /> Add Field
    </Button>
  </div>
</ModalForm>
