<script lang="ts">
  import { page } from '$app/state';
  import { Button } from '$lib/components/ui/button';
  import { Separator } from '$lib/components/ui/separator';
  import { Spinner } from '$lib/components/ui/spinner';
  import InfoRow from '$lib/frontend/components/InfoRow.svelte';
  import Section from '$lib/frontend/components/Section.svelte';
  import StatusBadge from '$lib/frontend/components/StatusBadge.svelte';
  import { submitWithToast } from '$lib/frontend/form-submit';
  import { modalManager } from '$lib/frontend/modal-manager.svelte';
  import {
    cancelCarBayBooking,
    getCarBayBookingByToken,
  } from '$lib/remotes/endpoints/car_bay.remote';
  import {
    CAR_BAY_REFUND_CUTOFF_HOURS,
    CAR_BAY_STATUS,
    CAR_BAY_TIER_NAMES,
    formatDollars,
    formatPeriod,
    toPeriod,
  } from '$lib/utils/car_bay';
  import type { CustomerCarBayBooking } from '$lib/remotes/dtos/car_bay.dto';
  import BanIcon from '@lucide/svelte/icons/ban';
  import CircleCheckIcon from '@lucide/svelte/icons/circle-check';

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

  const token = page.params.token ?? '';
  const bookingRemote = getCarBayBookingByToken(token);
  const booking = $derived(bookingRemote.current);

  let canceling = $state(false);

  async function handleCancel() {
    if (!booking) return;

    const willRefund = booking.refundable && booking.amountPaid > 0;
    const confirmed = await modalManager.confirm({
      title: 'Cancel Booking',
      prompt: willRefund
        ? "Cancel this booking? You'll get a full refund."
        : `Cancel this booking? It starts in less than ${CAR_BAY_REFUND_CUTOFF_HOURS} hours, so there's no refund.`,
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

{#if bookingRemote.loading}
  <Spinner class="mx-auto mt-12 size-8" />
{:else if !booking}
  <div class="rounded-lg border p-4 text-sm">
    <p class="font-medium text-destructive">Booking not found.</p>
    <p class="mt-1 text-muted-foreground">This booking may not exist or the link may be invalid.</p>
  </div>
{:else}
  {@const isConfirmed = booking.status === CAR_BAY_STATUS.CONFIRMED}
  <div class="flex flex-col gap-4">
    <div class="flex items-center gap-2">
      {#if isConfirmed}
        <CircleCheckIcon class="size-5 text-success" />
      {:else}
        <BanIcon class="size-5 text-destructive" />
      {/if}
      <h2 class="flex-1 text-lg font-semibold">
        {STATUS_HEADINGS[booking.status]}
      </h2>
      <StatusBadge tone={isConfirmed ? 'success' : 'danger'}>
        {STATUS_LABELS[booking.status]}
      </StatusBadge>
    </div>

    <Section title="Car Bay - {CAR_BAY_TIER_NAMES[booking.tier]}">
      <dl>
        <InfoRow label="When">{formatPeriod(toPeriod(booking))}</InfoRow>
        <InfoRow label="Name">{booking.customerName}</InfoRow>
        <InfoRow label="Email">{booking.customerEmail}</InfoRow>
        <InfoRow label="Amount Paid">{formatDollars(booking.amountPaid)}</InfoRow>
      </dl>
    </Section>

    <p class="rounded-lg border bg-muted/50 p-4 text-sm">
      You can move your own car outside when your booking ends, free of charge. It can stay on the
      property for up to 3 days from your booking's start date.
    </p>

    {#if isConfirmed}
      <Separator />
      <p class="text-sm text-muted-foreground">
        {booking.refundable
          ? `Cancel now and we refund you in full. Refunds stop ${CAR_BAY_REFUND_CUTOFF_HOURS} hours before your start time.`
          : `Your booking starts in less than ${CAR_BAY_REFUND_CUTOFF_HOURS} hours, so canceling now won't get a refund.`}
      </p>
      <Button
        variant="destructive"
        class="self-start max-sm:w-full"
        onclick={handleCancel}
        disabled={canceling}
      >
        {#if canceling}<Spinner />{:else}<BanIcon />{/if}
        Cancel Booking
      </Button>
    {/if}
  </div>
{/if}
