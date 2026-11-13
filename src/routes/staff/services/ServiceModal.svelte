<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Switch } from '$lib/components/ui/switch';
  import FormField from '$lib/frontend/components/form/FormField.svelte';
  import OptionSelect from '$lib/frontend/components/form/OptionSelect.svelte';
  import PriceInput from '$lib/frontend/components/form/PriceInput.svelte';
  import TextArea from '$lib/frontend/components/form/TextArea.svelte';
  import TextInput from '$lib/frontend/components/form/TextInput.svelte';
  import IconButton from '$lib/frontend/components/IconButton.svelte';
  import ModalForm from '$lib/frontend/components/ModalForm.svelte';
  import type { ModalProps } from '$lib/frontend/components/utils';
  import { submitWithToast } from '$lib/frontend/form-submit';
  import { upsertService } from '$lib/remotes/endpoints/service.remote';
  import type { Service } from '$lib/server/db/schema';
  import { CENTS_PER_DOLLAR } from '$lib/utils/billing';
  import {
    SERVICE_FIELD_TYPE,
    SERVICE_PRICING,
    type ServiceField,
    type ServicePricing,
  } from '$lib/utils/services';
  import ConciergeBellIcon from '@lucide/svelte/icons/concierge-bell';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import TrashIcon from '@lucide/svelte/icons/trash';

  type Props = ModalProps & { service?: Service };

  let { onClose, service }: Props = $props();

  const FIELD_ID_LENGTH = 8;
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

  // Choices are edited as comma separated text and split on save.
  type EditableField = Omit<ServiceField, 'options'> & { options: string };

  const initial = (() => service)();

  let name = $state(initial?.name ?? '');
  let description = $state(initial?.description ?? '');
  let pricingMode = $state<ServicePricing>(initial?.pricingMode ?? SERVICE_PRICING.FIXED);
  let price = $state(initial?.price ?? 0);
  let enabled = $state(initial?.enabled ?? true);
  let fields = $state<EditableField[]>(
    (initial?.fields ?? []).map((field) => ({ ...field, options: field.options.join(', ') })),
  );
  let submitting = $state(false);

  const canSubmit = $derived(name.trim() !== '' && description.trim() !== '');

  function addField() {
    fields.push({
      id: `f${crypto.randomUUID().slice(0, FIELD_ID_LENGTH)}`,
      label: '',
      type: SERVICE_FIELD_TYPE.TEXT,
      required: false,
      options: '',
    });
  }

  async function save() {
    submitting = true;
    const saved = await submitWithToast(
      () =>
        upsertService({
          id: service?.id,
          name,
          description,
          pricingMode,
          price,
          enabled,
          fields: fields.map((field) => ({
            ...field,
            options:
              field.type === SERVICE_FIELD_TYPE.SELECT
                ? field.options
                    .split(',')
                    .map((option) => option.trim())
                    .filter(Boolean)
                : [],
          })),
        }),
      { success: 'Service saved', error: 'Failed to save service' },
    );
    submitting = false;
    if (saved) onClose();
  }
</script>

<ModalForm
  title={service ? 'Edit Service' : 'New Service'}
  icon={ConciergeBellIcon}
  {onClose}
  submitLabel={service ? 'Save Changes' : 'Create Service'}
  {submitting}
  {canSubmit}
  onSubmit={save}
>
  <FormField label="Service Name" for="service-name" required>
    <TextInput id="service-name" bind:value={name} placeholder="Laser Engraving" />
  </FormField>

  <FormField label="Description" for="service-description" required>
    <TextArea
      id="service-description"
      bind:value={description}
      placeholder="What does this service include?"
    />
  </FormField>

  <FormField label="Pricing" for="service-pricing" required>
    <OptionSelect id="service-pricing" options={PRICING_OPTIONS} bind:value={pricingMode} />
  </FormField>

  {#if pricingMode === SERVICE_PRICING.FIXED}
    <FormField label="Price" required>
      <PriceInput bind:value={price} multiplier={CENTS_PER_DOLLAR} />
    </FormField>
  {/if}

  <div class="flex items-center justify-between">
    <label for="service-enabled" class="text-sm font-medium">Accepting requests</label>
    <Switch id="service-enabled" bind:checked={enabled} />
  </div>

  <div class="flex flex-col gap-2">
    <span class="text-sm font-medium">Request form fields</span>
    {#each fields as field, index (field.id)}
      <div class="flex flex-col gap-2 rounded-lg border p-3">
        <div class="flex gap-2">
          <TextInput
            class="flex-1"
            bind:value={field.label}
            aria-label="Field label"
            placeholder="Question or label"
          />
          <OptionSelect class="w-36" options={TYPE_OPTIONS} bind:value={field.type} />
          <IconButton
            icon={TrashIcon}
            aria-label="Remove field"
            onclick={() => fields.splice(index, 1)}
          />
        </div>
        {#if field.type === SERVICE_FIELD_TYPE.SELECT}
          <TextInput
            bind:value={field.options}
            aria-label="Choices"
            placeholder="Choices, separated by commas"
          />
        {/if}
        <label class="flex items-center gap-2 text-sm">
          <Switch bind:checked={field.required} /> Required
        </label>
      </div>
    {:else}
      <p class="text-sm text-muted-foreground">
        No fields. Customers only give their name and email.
      </p>
    {/each}
    <Button variant="outline" size="sm" class="self-start" onclick={addField}>
      <PlusIcon /> Add Field
    </Button>
  </div>
</ModalForm>
