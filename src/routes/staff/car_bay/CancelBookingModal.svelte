<script lang="ts">
  import { Label } from '$lib/components/ui/label';
  import { Switch } from '$lib/components/ui/switch';
  import ModalForm from '$lib/frontend/components/ModalForm.svelte';
  import type { ModalProps } from '$lib/frontend/components/utils';
  import { submitWithToast } from '$lib/frontend/form-submit';
  import { staffCancelCarBayBooking } from '$lib/remotes/endpoints/car_bay.remote';
  import { formatDollars } from '$lib/utils/car_bay';
  import BanIcon from '@lucide/svelte/icons/ban';
  import { untrack } from 'svelte';

  interface Props extends ModalProps<boolean> {
    bookingId: string;
    amountPaid: number;
    refundable: boolean;
    refundCutoffHours: number;
  }

  let { onClose, bookingId, amountPaid, refundable, refundCutoffHours }: Props = $props();

  const isPaid = $derived(amountPaid > 0);
  const fieldId = $props.id();

  let refund = $state(untrack(() => refundable && amountPaid > 0));
  let submitting = $state(false);

  async function handleSubmit() {
    submitting = true;
    const ok = await submitWithToast(
      () => staffCancelCarBayBooking({ bookingId, refund: isPaid && refund }),
      { success: 'Booking canceled', error: 'Failed to cancel booking' },
    );
    submitting = false;
    if (ok) onClose(true);
  }
</script>

<ModalForm
  title="Cancel Booking"
  icon={BanIcon}
  {onClose}
  submitLabel={refund && isPaid ? 'Cancel & Refund' : 'Cancel Booking'}
  submitIcon={BanIcon}
  {submitting}
  onSubmit={handleSubmit}
>
  <div class="flex items-start justify-between gap-4 rounded-lg border p-3">
    <div class="flex flex-col gap-1">
      <Label for="{fieldId}-refund">Refund {formatDollars(amountPaid)}</Label>
      <p class="text-xs text-muted-foreground">
        {#if !isPaid}
          Staff booking. Nothing was charged.
        {:else if refundable}
          Within policy. The booking starts more than {refundCutoffHours} hours from now.
        {:else}
          Outside policy. The booking starts in less than {refundCutoffHours} hours.
        {/if}
      </p>
    </div>
    <Switch id="{fieldId}-refund" bind:checked={refund} disabled={!isPaid} />
  </div>

  <p class="text-sm text-muted-foreground">The bay opens up for other bookings right away.</p>
</ModalForm>
