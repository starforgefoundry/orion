<script lang="ts">
  import FileUpload from '$lib/frontend/components/FileUpload.svelte';
  import FormField from '$lib/frontend/components/form/FormField.svelte';
  import HiddenField from '$lib/frontend/components/form/HiddenField.svelte';
  import PriceInput from '$lib/frontend/components/form/PriceInput.svelte';
  import TextArea from '$lib/frontend/components/form/TextArea.svelte';
  import TextInput from '$lib/frontend/components/form/TextInput.svelte';
  import { initForm } from '$lib/frontend/components/form/utils.svelte';
  import IconButton from '$lib/frontend/components/IconButton.svelte';
  import ModalForm from '$lib/frontend/components/ModalForm.svelte';
  import type { ModalProps } from '$lib/frontend/components/utils';
  import { enhanceWithToast } from '$lib/frontend/form-submit';
  import { upsertCatalogForm } from '$lib/remotes/endpoints/class.remote';
  import GraduationCapIcon from '@lucide/svelte/icons/graduation-cap';
  import TrashIcon from '@lucide/svelte/icons/trash';

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

<ModalForm
  title={isEditing ? 'Edit Class' : 'New Class'}
  icon={GraduationCapIcon}
  {onClose}
  submitLabel={isEditing ? 'Save Changes' : 'Create Class'}
  submitting={upsertCatalogForm.pending > 0}
  form={{
    ...enhanceWithToast(
      upsertCatalogForm,
      { success: 'Class saved', error: 'Failed to save class' },
      onClose,
    ),
    enctype: 'multipart/form-data',
  }}
>
  <input {...upsertCatalogForm.fields.id.as('text')} value={catalogId} hidden />

  <FormField label="Class Name" required>
    <TextInput {...upsertCatalogForm.fields.name.as('text')} placeholder="Welding Class" />
  </FormField>

  <FormField label="Description" required>
    <TextArea
      {...upsertCatalogForm.fields.description.as('text')}
      placeholder="Describe what students will learn..."
    />
  </FormField>

  <FormField label="Price" required>
    <PriceInput bind:value={price} multiplier={100} />
    <HiddenField field={upsertCatalogForm.fields.price} value={price} />
  </FormField>

  <div class="flex flex-col gap-1.5">
    <span class="text-sm font-medium">Cover Photo</span>

    <input accept="image/*" {...upsertCatalogForm.fields.photo.as('file')} hidden />

    {#if photoPreviewUrl}
      <div class="relative self-center">
        <img src={photoPreviewUrl} alt="Preview" class="max-h-36 rounded-lg object-cover" />
        <IconButton
          icon={TrashIcon}
          variant="destructive"
          class="absolute top-2 right-2"
          aria-label="Remove photo"
          onclick={clearPhoto}
        />
      </div>
    {:else}
      <FileUpload
        supportedExtensions={['jpg', 'jpeg', 'png', 'gif', 'webp']}
        onUpload={handlePhotoUpload}
        onUnsupported={() => {}}
      />
    {/if}
  </div>
</ModalForm>
