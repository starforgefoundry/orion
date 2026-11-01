<script lang="ts">
  import { page } from '$app/state';
  import { Button } from '$lib/components/ui/button';
  import { Spinner } from '$lib/components/ui/spinner';
  import BookingConfirmation from '$lib/frontend/components/BookingConfirmation.svelte';
  import BookingNotFound from '$lib/frontend/components/BookingNotFound.svelte';
  import InfoRow from '$lib/frontend/components/InfoRow.svelte';
  import QueryState from '$lib/frontend/components/QueryState.svelte';
  import Section from '$lib/frontend/components/Section.svelte';
  import { submitWithToast } from '$lib/frontend/form-submit';
  import { modalManager } from '$lib/frontend/modal-manager.svelte';
  import { formatTime } from '$lib/frontend/utils';
  import { cancelBooking, getBookingByToken } from '$lib/remotes/endpoints/class.remote';
  import { formatCents } from '$lib/utils/billing';
  import { calendarLinks } from '$lib/utils/calendar-links';
  import {
    CLASS_BOOKING_STATUS,
    CLASS_DATE_FORMAT,
    classEndsAt,
    classHasStarted,
    classStartsAt,
  } from '$lib/utils/classes';
  import CalendarPlusIcon from '@lucide/svelte/icons/calendar-plus';

  const token = $derived(page.params.token ?? '');
  const bookingQuery = $derived(getBookingByToken(token));
  const booking = $derived(bookingQuery.current);

  let canceling = $state(false);

  const calendar = $derived(
    booking?.instance && booking.catalog
      ? calendarLinks({
          uid: `booking-${booking.id}`,
          title: booking.catalog.name,
          details: [`Class: ${booking.catalog.name}`, `Booked by: ${booking.customerName}`],
          startsAt: classStartsAt(booking.instance),
          endsAt: classEndsAt(booking.instance),
        })
      : undefined,
  );

  async function handleCancel() {
    const confirmed = await modalManager.confirm({
      title: 'Cancel Booking',
      prompt: 'Are you sure you want to cancel this booking? You will receive a full refund.',
      confirmText: 'Cancel Booking',
      cancelText: 'Keep Booking',
      variant: 'destructive',
    });

    if (!confirmed) return;

    canceling = true;
    await submitWithToast(() => cancelBooking({ bookingToken: token }), {
      success: 'Booking canceled',
      error: 'Failed to cancel booking',
    });
    canceling = false;
  }
</script>

<svelte:head>
  <title>Booking Details - Starforge</title>
</svelte:head>

<QueryState query={bookingQuery} label="booking">
  {#snippet pending()}
    <Spinner class="mx-auto mt-12 size-8" />
  {/snippet}
  {#snippet children(booking)}
    {#if !booking || !booking.instance || !booking.catalog}
      <BookingNotFound />
    {:else}
      {@const instance = booking.instance}
      {@const isConfirmed = booking.status === CLASS_BOOKING_STATUS.CONFIRMED}
      <BookingConfirmation
        confirmed={isConfirmed}
        heading={isConfirmed ? 'Booking Confirmed' : 'Booking Canceled'}
        statusLabel={isConfirmed ? 'Confirmed' : 'Canceled'}
        title={booking.catalog.name}
        customerName={booking.customerName}
        customerEmail={booking.customerEmail}
        passTitle="Your Class Pass"
        passToken={booking.passToken}
        canCancel={!classHasStarted(instance)}
        {canceling}
        onCancel={handleCancel}
      >
        {#snippet details()}
          <InfoRow label="Date">{classStartsAt(instance).toFormat(CLASS_DATE_FORMAT)}</InfoRow>
          <InfoRow label="Time">
            {formatTime(instance.startTime)} ({instance.durationMinutes} min)
          </InfoRow>
        {/snippet}
        {#snippet payment()}
          <InfoRow label="Spots">{booking.quantity ?? 1}</InfoRow>
          <InfoRow label="Amount Paid">{formatCents(booking.amountPaid)}</InfoRow>
        {/snippet}
        {#snippet extras()}
          {#if isConfirmed}
            <Section title="Add to Calendar">
              <div class="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  href={calendar?.google}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <CalendarPlusIcon />
                  Google Calendar
                </Button>
                <Button
                  variant="outline"
                  href={calendar?.ics}
                  download="{booking.catalog?.name}.ics"
                >
                  <CalendarPlusIcon />
                  Apple Calendar / Other (.ics)
                </Button>
              </div>
            </Section>
          {:else}
            <p class="text-sm text-muted-foreground">
              This booking has been canceled and a refund has been issued.
            </p>
          {/if}
        {/snippet}
      </BookingConfirmation>
    {/if}
  {/snippet}
</QueryState>
