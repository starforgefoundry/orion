<script lang="ts">
  import FormField from '$lib/frontend/components/form/FormField.svelte';
  import OptionSelect from '$lib/frontend/components/form/OptionSelect.svelte';
  import ModalForm from '$lib/frontend/components/ModalForm.svelte';
  import type { ModalProps } from '$lib/frontend/components/utils';
  import { submitWithToast } from '$lib/frontend/form-submit';
  import { getAllInstances } from '$lib/remotes/endpoints/class.remote';
  import CalendarClockIcon from '@lucide/svelte/icons/calendar-clock';
  import CheckIcon from '@lucide/svelte/icons/check';
  import { untrack } from 'svelte';
  import { BookingReschedule } from './booking-reschedule.svelte';

  interface Props extends ModalProps {
    booking: { id: string; instanceId: string; customerName: string; quantity: number };
    classId: string;
    onRescheduled: () => void;
  }

  let { onClose, booking, classId, onRescheduled }: Props = $props();

  const reschedule = untrack(() => new BookingReschedule({ ...booking, classId }));
  const options = $derived(reschedule.options(getAllInstances().current ?? []));

  let submitting = $state(false);

  async function handleSubmit() {
    submitting = true;
    const ok = await submitWithToast(() => reschedule.submit(), {
      success: 'Booking rescheduled',
      error: 'Failed to reschedule booking',
    });
    submitting = false;
    if (ok) {
      onRescheduled();
      onClose();
    }
  }
</script>

<ModalForm
  title="Reschedule Booking"
  description={`Move ${booking.customerName}'s booking to another session of this class.`}
  icon={CalendarClockIcon}
  {onClose}
  submitLabel="Reschedule"
  submitIcon={CheckIcon}
  canSubmit={reschedule.canSubmit}
  {submitting}
  onSubmit={handleSubmit}
>
  {#if options.length === 0}
    <p class="text-sm text-muted-foreground">No upcoming sessions have enough open spots.</p>
  {:else}
    <FormField label="New Session" for="reschedule-session" required>
      <OptionSelect
        id="reschedule-session"
        {options}
        bind:value={reschedule.targetInstanceId}
        placeholder="Select a session"
      />
    </FormField>
  {/if}

  <p class="text-xs text-muted-foreground">
    The existing payment carries over. No new charge or refund is issued.
  </p>
</ModalForm>
