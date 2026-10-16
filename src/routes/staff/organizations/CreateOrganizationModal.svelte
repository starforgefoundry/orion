<script lang="ts">
  import ModalForm from '$lib/frontend/components/ModalForm.svelte';
  import FormField from '$lib/frontend/components/form/FormField.svelte';
  import TextInput from '$lib/frontend/components/form/TextInput.svelte';
  import type { ModalProps } from '$lib/frontend/components/utils';
  import { enhanceWithToast } from '$lib/frontend/form-submit';
  import { createOrganizationForm } from '$lib/remotes/endpoints/organization.remote';
  import UsersIcon from '@lucide/svelte/icons/users';

  let { onClose }: ModalProps = $props();
</script>

<ModalForm
  title="Create Organization"
  icon={UsersIcon}
  {onClose}
  submitLabel="Create Organization"
  submitting={createOrganizationForm.pending > 0}
  form={enhanceWithToast(
    createOrganizationForm,
    { success: 'Organization created', error: 'Failed to create organization' },
    onClose,
  )}
>
  <FormField label="Organization Name" required>
    <TextInput
      {...createOrganizationForm.fields.name.as('text')}
      placeholder="e.g., Engineering Club"
    />
  </FormField>
  <FormField label="Email" required>
    <TextInput
      {...createOrganizationForm.fields.email.as('email')}
      placeholder="e.g., club@example.com"
    />
  </FormField>
</ModalForm>
