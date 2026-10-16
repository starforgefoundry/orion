<script lang="ts">
  import { Input } from '$lib/components/ui/input';
  import FormField from '$lib/frontend/components/form/FormField.svelte';
  import ModalForm from '$lib/frontend/components/ModalForm.svelte';
  import type { ModalProps } from '$lib/frontend/components/utils';
  import { submitWithToast } from '$lib/frontend/form-submit';
  import { updatePrintRequest } from '$lib/remotes/endpoints/print_request.remote';
  import CheckIcon from '@lucide/svelte/icons/check';
  import UserPenIcon from '@lucide/svelte/icons/user-pen';
  import { untrack } from 'svelte';

  type Props = ModalProps & {
    requestId: string;
    currentName: string;
    currentEmail: string;
  };

  let { requestId, currentName, currentEmail, onClose }: Props = $props();

  let customerName = $state(untrack(() => currentName));
  let email = $state(untrack(() => currentEmail));
  let submitting = $state(false);

  const isValid = $derived(customerName.trim().length > 0 && email.trim().length > 0);

  async function handleSubmit() {
    if (!isValid || submitting) return;

    submitting = true;
    const ok = await submitWithToast(
      () =>
        updatePrintRequest({
          id: requestId,
          customerName: customerName.trim(),
          email: email.trim(),
        }),
      { success: 'Customer updated', error: 'Failed to update customer' },
    );
    submitting = false;

    if (ok) onClose();
  }
</script>

<ModalForm
  title="Edit Customer"
  icon={UserPenIcon}
  size="sm"
  {onClose}
  submitLabel="Save"
  submitIcon={CheckIcon}
  canSubmit={isValid}
  {submitting}
  onSubmit={handleSubmit}
>
  <FormField label="Full Name" for="customer-name" required>
    <Input id="customer-name" bind:value={customerName} placeholder="John Doe" />
  </FormField>

  <FormField label="Email" for="customer-email" required>
    <Input id="customer-email" bind:value={email} type="email" placeholder="john@example.com" />
  </FormField>
</ModalForm>
