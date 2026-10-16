<script lang="ts">
  import ModalForm from '$lib/frontend/components/ModalForm.svelte';
  import FormField from '$lib/frontend/components/form/FormField.svelte';
  import TextInput from '$lib/frontend/components/form/TextInput.svelte';
  import { initForm } from '$lib/frontend/components/form/utils.svelte';
  import type { ModalProps } from '$lib/frontend/components/utils';
  import { enhanceWithToast } from '$lib/frontend/form-submit';
  import { upsertInventoryItem } from '$lib/remotes/endpoints/inventory.remote';
  import PackageIcon from '@lucide/svelte/icons/package';

  interface Props extends ModalProps {
    itemId?: string;
    prefill?: {
      name: string;
      vendor: string;
      url: string;
      description: string;
    };
  }

  let { onClose, prefill, itemId }: Props = $props();

  initForm(upsertInventoryItem, () => ({
    id: itemId,
    name: prefill?.name ?? '',
    vendor: prefill?.vendor ?? '',
    url: prefill?.url ?? '',
    description: prefill?.description ?? '',
  }));
</script>

<ModalForm
  title={prefill ? 'Edit Inventory Item' : 'Create Inventory Item'}
  icon={PackageIcon}
  {onClose}
  submitLabel={prefill ? 'Update Item' : 'Create Item'}
  submitting={upsertInventoryItem.pending > 0}
  form={enhanceWithToast(
    upsertInventoryItem,
    { success: 'Inventory item saved', error: 'Failed to save inventory item' },
    onClose,
  )}
>
  <input {...upsertInventoryItem.fields.id.as('text')} value={itemId} hidden />

  <FormField label="Name" required>
    <TextInput {...upsertInventoryItem.fields.name.as('text')} placeholder="e.g., Filament Spool" />
  </FormField>

  <FormField label="Vendor" required>
    <TextInput {...upsertInventoryItem.fields.vendor.as('text')} placeholder="e.g., Amazon" />
  </FormField>

  <FormField label="URL" required>
    <TextInput {...upsertInventoryItem.fields.url.as('url')} placeholder="https://..." />
  </FormField>

  <FormField label="Description" required>
    <TextInput
      {...upsertInventoryItem.fields.description.as('text')}
      placeholder="Item description"
    />
  </FormField>
</ModalForm>
