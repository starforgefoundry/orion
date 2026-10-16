<script lang="ts">
  import { CarBayBookingForm } from '$lib/frontend/car-bay-booking-form.svelte';
  import CarBayBookingFields from '$lib/frontend/components/CarBayBookingFields.svelte';
  import ModalForm from '$lib/frontend/components/ModalForm.svelte';
  import type { ModalProps } from '$lib/frontend/components/utils';
  import { submitWithToast } from '$lib/frontend/form-submit';
  import { staffBookCarBay } from '$lib/remotes/endpoints/car_bay.remote';
  import { CAR_BAY_TIER, type CarBayPeriod } from '$lib/utils/car_bay';
  import CarIcon from '@lucide/svelte/icons/car';
  import CheckIcon from '@lucide/svelte/icons/check';
  import { untrack } from 'svelte';

  interface Props extends ModalProps {
    date: string;
    startHour: number;
    bookings: () => CarBayPeriod[];
    onBooked: () => Promise<void>;
  }

  let { onClose, date, startHour, bookings, onBooked }: Props = $props();

  const form = untrack(
    () =>
      new CarBayBookingForm(
        { bookings: () => bookings(), rates: () => undefined, enforceHorizon: false },
        { tier: CAR_BAY_TIER.QUICK_JOB, date, startHour },
      ),
  );

  let submitting = $state(false);

  async function handleSubmit() {
    submitting = true;
    const ok = await submitWithToast(
      () => staffBookCarBay({ request: form.request, ...form.customer(), isMember: form.isMember }),
      { success: 'Booking added', error: 'Failed to add booking' },
    );
    submitting = false;

    if (!ok) return;
    await onBooked();
    onClose();
  }
</script>

<ModalForm
  title="New Car Bay Booking"
  icon={CarIcon}
  {onClose}
  submitLabel="Add Booking"
  submitIcon={CheckIcon}
  canSubmit={form.canSubmit}
  {submitting}
  onSubmit={handleSubmit}
>
  <CarBayBookingFields {form} editableSchedule />

  <p class="text-xs text-muted-foreground">
    Staff bookings are free and can be made any distance ahead. The customer still gets a
    confirmation email.
  </p>
</ModalForm>
