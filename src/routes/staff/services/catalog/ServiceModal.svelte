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
  import type { Service } from '$lib/server/db/schema';
  import { CENTS_PER_DOLLAR } from '$lib/utils/billing';
  import { SERVICE_FIELD_TYPE, SERVICE_PRICING } from '$lib/utils/services';
  import ConciergeBellIcon from '@lucide/svelte/icons/concierge-bell';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import TrashIcon from '@lucide/svelte/icons/trash';
  import { untrack } from 'svelte';
  import { ServiceEditor } from './service-editor.svelte';

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
  {onClose}
  submitLabel={editor.isNew ? 'Create Service' : 'Save Changes'}
  canSubmit={editor.canSave}
  submitting={editor.saving}
  onSubmit={save}
>
  <FormField label="Service Name" for="service-name" required>
    <TextInput id="service-name" bind:value={editor.name} placeholder="Laser Engraving" />
  </FormField>

  <FormField label="Description" for="service-description" required>
    <TextArea
      id="service-description"
      bind:value={editor.description}
      placeholder="What does this service include?"
    />
  </FormField>

  <FormField label="Pricing" for="service-pricing" required>
    <OptionSelect id="service-pricing" options={PRICING_OPTIONS} bind:value={editor.pricingMode} />
  </FormField>

  {#if editor.pricingMode === SERVICE_PRICING.FIXED}
    <FormField label="Price" required>
      <PriceInput bind:value={editor.price} multiplier={CENTS_PER_DOLLAR} />
    </FormField>
  {/if}

  <div class="flex items-center justify-between">
    <label for="service-enabled" class="text-sm font-medium">Accepting requests</label>
    <Switch id="service-enabled" bind:checked={editor.enabled} />
  </div>

  <div class="flex flex-col gap-2">
    <span class="text-sm font-medium">Request form fields</span>
    {#each editor.fields as field, index (field.id)}
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
            onclick={() => editor.removeField(index)}
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
    <Button variant="outline" size="sm" class="self-start" onclick={() => editor.addField()}>
      <PlusIcon /> Add Field
    </Button>
  </div>
</ModalForm>
