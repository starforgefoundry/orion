<script lang="ts">
  import type { ModalProps } from '$lib/frontend/components/utils';
  import { updatePrintRequest } from '$lib/remotes/endpoints/print_request.remote';
  import { Button, Field, HStack, Input, Modal, ModalBody, Stack, toastManager } from '@immich/ui';
  import { mdiAccountEdit, mdiCheck } from '@mdi/js';
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

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!isValid || submitting) return;

    submitting = true;
    try {
      await updatePrintRequest({
        id: requestId,
        customerName: customerName.trim(),
        email: email.trim(),
      });
      toastManager.success('Customer updated');
      onClose();
    } catch (error: any) {
      toastManager.danger(error?.message ?? 'Failed to update customer');
    } finally {
      submitting = false;
    }
  }
</script>

<Modal title="Edit Customer" icon={mdiAccountEdit} {onClose}>
  <ModalBody>
    <form onsubmit={handleSubmit}>
      <Stack gap={4}>
        <Field label="Full Name" required="indicator">
          <Input bind:value={customerName} placeholder="John Doe" />
        </Field>

        <Field label="Email" required="indicator">
          <Input bind:value={email} type="email" placeholder="john@example.com" />
        </Field>

        <HStack class="justify-end">
          <Button
            type="submit"
            color="success"
            leadingIcon={mdiCheck}
            loading={submitting}
            disabled={submitting || !isValid}
          >
            Save
          </Button>
        </HStack>
      </Stack>
    </form>
  </ModalBody>
</Modal>
