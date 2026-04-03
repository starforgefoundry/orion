<script lang="ts">
  import NumberStepper from '$lib/frontend/components/form/NumberStepper.svelte';
  import type { ModalProps } from '$lib/frontend/components/utils';
  import {
    Button,
    Field,
    HStack,
    Input,
    Modal,
    ModalBody,
    Stack,
    Text,
    toastManager,
  } from '@immich/ui';
  import { mdiAccountPlus, mdiCheck } from '@mdi/js';

  interface Props extends ModalProps {
    instanceId: string;
    availableSpots: number;
    onBookingCreated: () => void;
  }

  let { onClose, instanceId, availableSpots, onBookingCreated }: Props = $props();

  let customerName = $state('');
  let customerEmail = $state('');
  let customerPhone = $state('');
  let quantity = $state(1);
  let submitting = $state(false);

  const isValid = $derived(
    customerName.trim().length > 0 &&
      customerEmail.trim().length > 0 &&
      customerPhone.trim().length > 0,
  );

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!isValid || submitting) return;

    submitting = true;
    try {
      const { manualBookClass } = await import('$lib/remotes/endpoints/class.remote');
      await manualBookClass({
        instanceId,
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        customerPhone: customerPhone.trim(),
        quantity,
      });
      toastManager.success('Booking added');
      onBookingCreated();
      onClose();
    } catch (error: any) {
      toastManager.danger(error?.message ?? 'Failed to add booking');
    } finally {
      submitting = false;
    }
  }
</script>

<Modal title="Add Booking" icon={mdiAccountPlus} {onClose}>
  <ModalBody>
    <form onsubmit={handleSubmit}>
      <Stack gap={4}>
        <Field label="Full Name" required="indicator">
          <Input bind:value={customerName} placeholder="John Doe" />
        </Field>

        <Field label="Email" required="indicator">
          <Input bind:value={customerEmail} type="email" placeholder="john@example.com" />
        </Field>

        <Field label="Phone Number" required="indicator">
          <Input bind:value={customerPhone} type="tel" placeholder="(555) 123-4567" />
        </Field>

        <div class="flex items-center justify-between">
          <Text>Attendees</Text>
          <NumberStepper bind:value={quantity} min={1} max={availableSpots} />
        </div>

        <Text size="small" color="muted" class="mt-2">
          No payment will be collected. Cancelling this booking will not issue a refund.
        </Text>

        <HStack class="justify-end">
          <Button
            type="submit"
            color="success"
            leadingIcon={mdiCheck}
            loading={submitting}
            disabled={submitting || !isValid}
          >
            Add Booking
          </Button>
        </HStack>
      </Stack>
    </form>
  </ModalBody>
</Modal>
