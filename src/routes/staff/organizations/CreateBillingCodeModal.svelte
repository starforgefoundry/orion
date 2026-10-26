<script lang="ts">
  import ModalForm from '$lib/frontend/components/ModalForm.svelte';
  import FormField from '$lib/frontend/components/form/FormField.svelte';
  import TextInput from '$lib/frontend/components/form/TextInput.svelte';
  import type { ModalProps } from '$lib/frontend/components/utils';
  import { enhanceWithToast } from '$lib/frontend/form-submit';
  import { createBillingCode } from '$lib/remotes/endpoints/billing_code.remote';
  import TicketIcon from '@lucide/svelte/icons/ticket';

  interface Props extends ModalProps {
    organizationId: string;
  }

  let { onClose, organizationId }: Props = $props();
</script>

<ModalForm
  title="Create Group Code"
  icon={TicketIcon}
  {onClose}
  submitLabel="Create Group Code"
  submitting={createBillingCode.pending > 0}
  form={enhanceWithToast(
    createBillingCode,
    { success: 'Group code created', error: 'Failed to create group code' },
    onClose,
  )}
>
  <input hidden {...createBillingCode.fields.organizationId.as('text')} value={organizationId} />

  <FormField
    label="Code"
    required
    description="Customers enter this on a print request to bill it to the organization."
  >
    <TextInput {...createBillingCode.fields.code.as('text')} placeholder="e.g., ENGCLUB2024" />
  </FormField>

  <FormField label="Description" required>
    <TextInput
      {...createBillingCode.fields.description.as('text')}
      placeholder="e.g., Engineering Club"
    />
  </FormField>
</ModalForm>
