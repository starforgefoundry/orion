<script lang="ts">
  import FormField from '$lib/frontend/components/form/FormField.svelte';
  import OptionSelect from '$lib/frontend/components/form/OptionSelect.svelte';
  import ModalForm from '$lib/frontend/components/ModalForm.svelte';
  import type { ModalProps } from '$lib/frontend/components/utils';
  import { getAllInstances } from '$lib/remotes/endpoints/class.remote';
  import CalendarClockIcon from '@lucide/svelte/icons/calendar-clock';
  import CheckIcon from '@lucide/svelte/icons/check';
  import { untrack } from 'svelte';
  import { BookingReschedule, type ReschedulableBooking } from './booking-reschedule.svelte';

  interface Props extends ModalProps {
    booking: ReschedulableBooking;
    classId: string;
  }

  let { onClose, booking, classId }: Props = $props();

  const reschedule = untrack(() => new BookingReschedule(booking, classId));
  const options = $derived(reschedule.options(getAllInstances().current ?? []));

  async function handleSubmit() {
    if (await reschedule.submit()) onClose();
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
  submitting={reschedule.submitting}
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
