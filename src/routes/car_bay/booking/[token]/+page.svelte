<script lang="ts">
  import { page } from '$app/state';
  import { Spinner } from '$lib/components/ui/spinner';
  import BookingConfirmation from '$lib/frontend/components/BookingConfirmation.svelte';
  import BookingNotFound from '$lib/frontend/components/BookingNotFound.svelte';
  import InfoRow from '$lib/frontend/components/InfoRow.svelte';
  import QueryState from '$lib/frontend/components/QueryState.svelte';
  import ContactLine from '../../ContactLine.svelte';
  import { submitWithToast } from '$lib/frontend/form-submit';
  import { modalManager } from '$lib/frontend/modal-manager.svelte';
  import {
    cancelCarBayBooking,
    getCarBayBookingByToken,
  } from '$lib/remotes/endpoints/car-bay.remote';
  import { getCarBayPolicy } from '$lib/remotes/endpoints/settings.remote';
  import {
    CAR_BAY_STATUS,
    DEFAULT_CAR_BAY_POLICY,
    CAR_BAY_TIER_NAMES,
    formatDollars,
    formatPeriod,
    toPeriod,
  } from '$lib/utils/car-bay';
  import type { CustomerCarBayBooking } from '$lib/remotes/dtos/car-bay.dto';

  const STATUS_HEADINGS: Record<CustomerCarBayBooking['status'], string> = {
    confirmed: 'Booking Confirmed',
    canceled: 'Booking Canceled',
    no_show: 'Marked as a No-show',
  };

  const STATUS_LABELS: Record<CustomerCarBayBooking['status'], string> = {
    confirmed: 'Confirmed',
    canceled: 'Canceled',
    no_show: 'No-show',
  };

  const token = $derived(page.params.token ?? '');
  const bookingQuery = $derived(getCarBayBookingByToken(token));
  const policyQuery = $derived(getCarBayPolicy());
  const refundCutoffHours = $derived(
    policyQuery.current?.refundCutoffHours ?? DEFAULT_CAR_BAY_POLICY.refundCutoffHours,
  );
  const booking = $derived(bookingQuery.current);

  let canceling = $state(false);

  async function handleCancel() {
    if (!booking) return;

    const willRefund = booking.refundable && booking.amountPaid > 0;
    const confirmed = await modalManager.confirm({
      title: 'Cancel Booking',
      prompt: willRefund
        ? "Cancel this booking? You'll get a full refund."
        : `Cancel this booking? It starts in less than ${refundCutoffHours} hours, so there's no refund.`,
      confirmText: 'Cancel Booking',
      cancelText: 'Keep Booking',
      variant: 'destructive',
    });
    if (!confirmed) return;

    canceling = true;
    await submitWithToast(() => cancelCarBayBooking({ bookingToken: token }), {
      success: 'Booking canceled',
      error: 'Failed to cancel booking',
    });
    canceling = false;
  }
</script>

<svelte:head>
  <title>Car Bay Booking - Starforge</title>
</svelte:head>

{#snippet pending()}
  <Spinner class="mx-auto mt-12 size-8" />
{/snippet}

<QueryState query={policyQuery} label="car bay rules" {pending}>
  <QueryState query={bookingQuery} label="booking" {pending}>
    {#snippet children(booking)}
      {#if !booking}
        <BookingNotFound />
      {:else}
        <BookingConfirmation
          confirmed={booking.status === CAR_BAY_STATUS.CONFIRMED}
          heading={STATUS_HEADINGS[booking.status]}
          statusLabel={STATUS_LABELS[booking.status]}
          title="Car Bay - {CAR_BAY_TIER_NAMES[booking.tier]}"
          customerName={booking.customerName}
          customerEmail={booking.customerEmail}
          passTitle="Your Car Bay Pass"
          passToken={booking.passToken}
          canCancel
          {canceling}
          onCancel={handleCancel}
        >
          {#snippet details()}
            <InfoRow label="When">{formatPeriod(toPeriod(booking))}</InfoRow>
          {/snippet}
          {#snippet payment()}
            <InfoRow label="Amount Paid">{formatDollars(booking.amountPaid)}</InfoRow>
          {/snippet}
          {#snippet extras()}
            <ContactLine />
          {/snippet}
          {#snippet cancelNotice()}
            <p class="text-sm text-muted-foreground">
              {booking.refundable
                ? `Cancel now and we refund you in full. Refunds stop ${refundCutoffHours} hours before your start time.`
                : `Your booking starts in less than ${refundCutoffHours} hours, so canceling now won't get a refund.`}
            </p>
          {/snippet}
        </BookingConfirmation>
      {/if}
    {/snippet}
  </QueryState>
</QueryState>
