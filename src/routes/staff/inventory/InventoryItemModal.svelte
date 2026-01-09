<script lang="ts">
  import FileUpload from '$lib/frontend/components/FileUpload.svelte';
  import TextInput from '$lib/frontend/components/form/TextInput.svelte';
  import type { CreateOrUpdate, ModalProps } from '$lib/frontend/components/utils';
  import type { InventoryItemDto } from '$lib/remotes/dtos/inventory.dto';
  import {
    createInventoryItem,
    deleteInventoryImage,
    updateInventoryItem,
    uploadInventoryImage,
  } from '$lib/remotes/endpoints/inventory.remote';
  import { Button, Field, IconButton, Modal, ModalBody, Stack } from '@immich/ui';
  import { mdiPackageVariant, mdiTrashCan } from '@mdi/js';

  type Props = ModalProps & CreateOrUpdate<InventoryItemDto>;

  let { onClose, ...props }: Props = $props();

  let isEdit = $derived(props.type === 'edit');
  let item = $derived(isEdit && props.type === 'edit' ? props.item : undefined);

  let name = $state('');
  let vendor = $state('');
  let url = $state('');
  let description = $state('');
  let imageUrl = $state<string | null>(null);
  let isUploading = $state(false);

  async function handleImageUpload(file: File) {
    if (!isEdit || !item) return;

    isUploading = true;
    try {
      const result = await uploadInventoryImage({ id: item.id, image: file });
      imageUrl = result.imageUrl;
    } catch (error) {
      console.error('Failed to upload image:', error);
    } finally {
      isUploading = false;
    }
  }

  async function handleImageDelete() {
    if (!isEdit || !item) return;

    try {
      await deleteInventoryImage({ id: item.id });
      imageUrl = null;
    } catch (error) {
      console.error('Failed to delete image:', error);
    }
  }

  function handleUnsupported(file: File) {
    alert(`File type not supported: ${file.name}`);
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();

    if (isEdit && item) {
      await updateInventoryItem({
        id: item.id,
        name,
        vendor,
        url,
        description,
      });
    } else {
      // For create, use the form
      return;
    }

    onClose();
  }

  $effect(() => {
    if (isEdit && item) {
      name = item.name;
      vendor = item.vendor;
      url = item.url;
      description = item.description;
      imageUrl = item.imageUrl ?? null;
    }
  });
</script>

<Modal title="{isEdit ? 'Edit' : 'Create'} Inventory Item" icon={mdiPackageVariant} {onClose}>
  <ModalBody>
    {#if isEdit}
      <form onsubmit={handleSubmit}>
        <Stack gap={4}>
          <Field label="Name" required="indicator">
            <input
              type="text"
              bind:value={name}
              placeholder="e.g., Filament Spool"
              class="w-full rounded-lg border border-gray-300 px-3 py-2"
              required
            />
          </Field>

          <Field label="Vendor" required="indicator">
            <input
              type="text"
              bind:value={vendor}
              placeholder="e.g., Amazon"
              class="w-full rounded-lg border border-gray-300 px-3 py-2"
              required
            />
          </Field>

          <Field label="URL" required="indicator">
            <input
              type="url"
              bind:value={url}
              placeholder="https://..."
              class="w-full rounded-lg border border-gray-300 px-3 py-2"
              required
            />
          </Field>

          <Field label="Description" required="indicator">
            <input
              type="text"
              bind:value={description}
              placeholder="Item description"
              class="w-full rounded-lg border border-gray-300 px-3 py-2"
              required
            />
          </Field>

          <Field label="Item Image">
            {#if imageUrl}
              <div class="relative inline-block">
                <img src={imageUrl} alt="Item" class="h-48 w-48 rounded-lg object-cover" />
                <IconButton
                  icon={mdiTrashCan}
                  color="danger"
                  class="absolute top-2 right-2"
                  aria-label="Delete Image"
                  onclick={handleImageDelete}
                />
              </div>
            {:else}
              <FileUpload
                onUpload={handleImageUpload}
                onUnsupported={handleUnsupported}
                supportedExtensions={['jpg', 'jpeg', 'png', 'gif', 'webp']}
              />
              {#if isUploading}
                <p class="mt-2 text-sm text-gray-500">Uploading...</p>
              {/if}
            {/if}
          </Field>

          <Button type="submit" variant="filled" fullWidth>Save Changes</Button>
        </Stack>
      </form>
    {:else}
      <form {...createInventoryItem} onsubmit={() => onClose()}>
        <Stack gap={4}>
          <Field label="Name" required="indicator">
            <TextInput
              {...createInventoryItem.fields.name.as('text')}
              placeholder="e.g., Filament Spool"
            />
          </Field>

          <Field label="Vendor" required="indicator">
            <TextInput
              {...createInventoryItem.fields.vendor.as('text')}
              placeholder="e.g., Amazon"
            />
          </Field>

          <Field label="URL" required="indicator">
            <TextInput {...createInventoryItem.fields.url.as('url')} placeholder="https://..." />
          </Field>

          <Field label="Description" required="indicator">
            <TextInput
              {...createInventoryItem.fields.description.as('text')}
              placeholder="Item description"
            />
          </Field>

          <Button type="submit" variant="filled" fullWidth>Create Item</Button>
        </Stack>
      </form>
    {/if}
  </ModalBody>
</Modal>
