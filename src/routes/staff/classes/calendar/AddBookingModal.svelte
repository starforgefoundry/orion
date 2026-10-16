<script lang="ts">
  import FormField from '$lib/frontend/components/form/FormField.svelte';
  import NumberStepper from '$lib/frontend/components/form/NumberStepper.svelte';
  import TextInput from '$lib/frontend/components/form/TextInput.svelte';
  import ModalForm from '$lib/frontend/components/ModalForm.svelte';
  import type { ModalProps } from '$lib/frontend/components/utils';
  import { submitWithToast } from '$lib/frontend/form-submit';
  import CheckIcon from '@lucide/svelte/icons/check';
  import UserPlusIcon from '@lucide/svelte/icons/user-plus';

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

  async function handleSubmit() {
    if (!isValid || submitting) return;

    submitting = true;
    const ok = await submitWithToast(
      async () => {
        const { manualBookClass } = await import('$lib/remotes/endpoints/class.remote');
        await manualBookClass({
          instanceId,
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim(),
          customerPhone: customerPhone.trim(),
          quantity,
        });
      },
      { success: 'Booking added', error: 'Failed to add booking' },
    );
    submitting = false;

    if (ok) {
      onBookingCreated();
      onClose();
    }
  }
</script>

<ModalForm
  title="Add Booking"
  icon={UserPlusIcon}
  {onClose}
  submitLabel="Add Booking"
  submitIcon={CheckIcon}
  canSubmit={isValid}
  {submitting}
  onSubmit={handleSubmit}
>
  <FormField label="Full Name" for="booking-name" required>
    <TextInput id="booking-name" bind:value={customerName} placeholder="John Doe" />
  </FormField>

  <FormField label="Email" for="booking-email" required>
    <TextInput
      id="booking-email"
      bind:value={customerEmail}
      type="email"
      placeholder="john@example.com"
    />
  </FormField>

  <FormField label="Phone Number" for="booking-phone" required>
    <TextInput
      id="booking-phone"
      bind:value={customerPhone}
      type="tel"
      placeholder="(555) 123-4567"
    />
  </FormField>

  <div class="flex items-center justify-between gap-3">
    <span class="text-sm font-medium">Attendees</span>
    <NumberStepper bind:value={quantity} min={1} max={availableSpots} />
  </div>

  <p class="text-xs text-muted-foreground">
    No payment will be collected. Cancelling this booking will not issue a refund.
  </p>
</ModalForm>
