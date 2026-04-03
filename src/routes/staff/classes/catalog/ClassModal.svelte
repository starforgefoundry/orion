<script lang="ts">
  import FileUpload from '$lib/frontend/components/FileUpload.svelte';
  import PriceInput from '$lib/frontend/components/form/PriceInput.svelte';
  import TextArea from '$lib/frontend/components/form/TextArea.svelte';
  import TextInput from '$lib/frontend/components/form/TextInput.svelte';
  import { initForm } from '$lib/frontend/components/form/utils.svelte';
  import type { ModalProps } from '$lib/frontend/components/utils';
  import { upsertCatalogForm } from '$lib/remotes/endpoints/class.remote';
  import { Button, Field, IconButton, Modal, ModalBody, Stack, Text } from '@immich/ui';
  import { mdiDelete, mdiGoogleClassroom } from '@mdi/js';

  interface Props extends ModalProps {
    catalogId?: string;
    prefill?: {
      name: string;
      description: string;
      price: number;
      photoUrl: string | null;
    };
  }

  let { onClose, catalogId, prefill }: Props = $props();

  const isEditing = $derived(!!catalogId);

  const initial = (() => ({
    price: prefill?.price ?? 0,
    photoPreviewUrl: prefill?.photoUrl ?? '',
  }))();

  let price = $state(initial.price);
  let photoPreviewUrl = $state(initial.photoPreviewUrl);

  initForm(upsertCatalogForm, () => ({
    id: catalogId,
    name: prefill?.name ?? '',
    description: prefill?.description ?? '',
    price: prefill?.price ?? 0,
  }));

  $effect(() => {
    upsertCatalogForm.fields.price.set(price);
  });

  function handlePhotoUpload(file: File) {
    photoPreviewUrl = URL.createObjectURL(file);

    const dt = new DataTransfer();
    dt.items.add(file);

    const input = document.querySelector<HTMLInputElement>('input[name="photo"]');
    if (input) {
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function clearPhoto() {
    photoPreviewUrl = '';
  }
</script>

<Modal title={isEditing ? 'Edit Class' : 'New Class'} icon={mdiGoogleClassroom} {onClose}>
  <ModalBody>
    <form {...upsertCatalogForm} onsubmit={() => onClose()} enctype="multipart/form-data">
      <input {...upsertCatalogForm.fields.id.as('text')} value={catalogId} hidden />

      <Stack gap={4}>
        <Field label="Class Name" required="indicator">
          <TextInput {...upsertCatalogForm.fields.name.as('text')} placeholder="Welding Class" />
        </Field>

        <Field label="Description" required="indicator">
          <TextArea
            {...upsertCatalogForm.fields.description.as('text')}
            placeholder="Describe what students will learn..."
          />
        </Field>

        <Field label="Price" required="indicator">
          <PriceInput bind:value={price} multiplier={100} />
          <input {...upsertCatalogForm.fields.price.as('number')} hidden />
        </Field>

        <Text>Cover Photo</Text>

        <input accept="image/*" {...upsertCatalogForm.fields.photo.as('file')} hidden />

        {#if photoPreviewUrl}
          <div class="relative mb-2 self-center">
            <img src={photoPreviewUrl} alt="Preview" class="max-h-36 rounded-lg object-cover" />
            <IconButton
              color="danger"
              class="absolute top-2 right-2 h-8 w-8 "
              aria-label="Remove photo"
              onclick={clearPhoto}
              icon={mdiDelete}
            />
          </div>
        {:else}
          <FileUpload
            supportedExtensions={['jpg', 'jpeg', 'png', 'gif', 'webp']}
            onUpload={handlePhotoUpload}
            onUnsupported={() => {}}
          />
        {/if}
        <Button type="submit" variant="filled" fullWidth>
          {isEditing ? 'Save Changes' : 'Create Class'}
        </Button>
      </Stack>
    </form>
  </ModalBody>
</Modal>
