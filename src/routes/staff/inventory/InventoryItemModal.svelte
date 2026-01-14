<script lang="ts">
  import TextInput from '$lib/frontend/components/form/TextInput.svelte';
  import { initForm } from '$lib/frontend/components/form/utils.svelte';
  import type { ModalProps } from '$lib/frontend/components/utils';
  import { upsertInventoryItem } from '$lib/remotes/endpoints/inventory.remote';
  import { Button, Field, Modal, ModalBody, Stack } from '@immich/ui';
  import { mdiPackageVariant } from '@mdi/js';

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

<Modal
  title={prefill ? 'Edit Inventory Item' : 'Create Inventory Item'}
  icon={mdiPackageVariant}
  {onClose}
>
  <ModalBody>
    <form {...upsertInventoryItem} onsubmit={() => onClose()}>
      <input {...upsertInventoryItem.fields.id.as('text')} value={itemId} hidden />

      <Stack gap={4}>
        <Field label="Name" required="indicator">
          <TextInput
            {...upsertInventoryItem.fields.name.as('text')}
            placeholder="e.g., Filament Spool"
          />
        </Field>

        <Field label="Vendor" required="indicator">
          <TextInput {...upsertInventoryItem.fields.vendor.as('text')} placeholder="e.g., Amazon" />
        </Field>

        <Field label="URL" required="indicator">
          <TextInput {...upsertInventoryItem.fields.url.as('url')} placeholder="https://..." />
        </Field>

        <Field label="Description" required="indicator">
          <TextInput
            {...upsertInventoryItem.fields.description.as('text')}
            placeholder="Item description"
          />
        </Field>

        <Button type="submit" variant="filled" fullWidth
          >{prefill ? 'Update Item' : 'Create Item'}</Button
        >
      </Stack>
    </form>
  </ModalBody>
</Modal>
