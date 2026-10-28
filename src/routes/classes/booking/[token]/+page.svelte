<script lang="ts">
  import { page } from '$app/state';
  import { formatTime } from '$lib/frontend/utils';
  import { cancelBooking, getBookingByToken } from '$lib/remotes/endpoints/class.remote';
  import { Button } from '$lib/components/ui/button';
  import { Separator } from '$lib/components/ui/separator';
  import { Spinner } from '$lib/components/ui/spinner';
  import InfoRow from '$lib/frontend/components/InfoRow.svelte';
  import Section from '$lib/frontend/components/Section.svelte';
  import PassCard from '$lib/frontend/member-pass/PassCard.svelte';
  import StatusBadge from '$lib/frontend/components/StatusBadge.svelte';
  import { modalManager } from '$lib/frontend/modal-manager.svelte';
  import BanIcon from '@lucide/svelte/icons/ban';
  import { formatCents } from '$lib/utils/billing';
  import CalendarPlusIcon from '@lucide/svelte/icons/calendar-plus';
  import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
  import { DateTime } from 'luxon';

  const token = page.params.token ?? '';
  const bookingRemote = getBookingByToken(token);
  const booking = $derived(bookingRemote.current);

  let canceling = $state(false);

  function getBookingDate() {
    if (!booking?.instance) return '';
    return DateTime.fromISO(booking.instance.date, { zone: 'America/Chicago' }).toFormat(
      'EEEE, MMMM d, yyyy',
    );
  }

  function getGoogleCalendarUrl() {
    if (!booking?.instance || !booking?.catalog) return '';

    const inst = booking.instance;
    const [hours, minutes] = inst.startTime.split(':').map(Number);
    const startDt = DateTime.fromISO(inst.date, { zone: 'America/Chicago' }).set({
      hour: hours,
      minute: minutes,
    });
    const endDt = startDt.plus({ minutes: inst.durationMinutes });

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: booking.catalog.name,
      dates: `${startDt.toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'")}/${endDt.toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'")}`,
      details: `Class: ${booking.catalog.name}\nBooked by: ${booking.customerName}`,
      location: 'Starforge Foundry',
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  function getIcsDownloadUrl() {
    if (!booking?.instance || !booking?.catalog) return '';

    const inst = booking.instance;
    const [hours, minutes] = inst.startTime.split(':').map(Number);
    const startDt = DateTime.fromISO(inst.date, { zone: 'America/Chicago' }).set({
      hour: hours,
      minute: minutes,
    });
    const endDt = startDt.plus({ minutes: inst.durationMinutes });

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Starforge//Class Booking//EN',
      'BEGIN:VEVENT',
      `DTSTART;TZID=America/Chicago:${startDt.toFormat("yyyyMMdd'T'HHmmss")}`,
      `DTEND;TZID=America/Chicago:${endDt.toFormat("yyyyMMdd'T'HHmmss")}`,
      `SUMMARY:${booking.catalog.name}`,
      `DESCRIPTION:Class: ${booking.catalog.name}\\nBooked by: ${booking.customerName}`,
      `UID:booking-${booking.id}@starforgefoundry.com`,
      `DTSTAMP:${DateTime.now().toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'")}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics);
  }

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
    try {
      await cancelBooking({ bookingToken: token });
      await getBookingByToken(token).refresh();
    } catch (error: any) {
      modalManager.confirm({
        title: 'Error',
        prompt: error?.message ?? 'Failed to cancel booking',
        confirmText: 'OK',
        hideCancel: true,
      });
    } finally {
      canceling = false;
    }
  }
</script>

<svelte:head>
  <title>Booking Details - Starforge</title>
</svelte:head>

{#if bookingRemote.loading}
  <Spinner class="mx-auto mt-12 size-8" />
{:else if !booking || !booking.instance || !booking.catalog}
  <div class="rounded-lg border p-4 text-sm">
    <p class="font-medium text-destructive">Booking not found.</p>
    <p class="mt-1 text-muted-foreground">This booking may not exist or the link may be invalid.</p>
  </div>
{:else}
  {@const isConfirmed = booking.status === 'confirmed'}
  <div class="flex flex-col gap-4">
    <div class="flex items-center gap-2">
      {#if isConfirmed}
        <CircleCheckIcon class="size-5 text-success" />
      {:else}
        <BanIcon class="size-5 text-destructive" />
      {/if}
      <h2 class="flex-1 text-lg font-semibold">
        {isConfirmed ? 'Booking Confirmed' : 'Booking Canceled'}
      </h2>
      <StatusBadge tone={isConfirmed ? 'success' : 'danger'}>
        {isConfirmed ? 'Confirmed' : 'Canceled'}
      </StatusBadge>
    </div>

    <Section title={booking.catalog.name}>
      <dl>
        <InfoRow label="Date">{getBookingDate()}</InfoRow>
        <InfoRow label="Time">
          {formatTime(booking.instance.startTime)} ({booking.instance.durationMinutes} min)
        </InfoRow>
        <InfoRow label="Name">{booking.customerName}</InfoRow>
        <InfoRow label="Email">{booking.customerEmail}</InfoRow>
        <InfoRow label="Spots">{booking.quantity ?? 1}</InfoRow>
        <InfoRow label="Amount Paid">{formatCents(booking.amountPaid)}</InfoRow>
      </dl>
    </Section>

    {#if isConfirmed}
      <Section title="Your Class Pass">
        <PassCard token={booking.passToken} />
      </Section>

      <Section title="Add to Calendar">
        <div class="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            href={getGoogleCalendarUrl()}
            target="_blank"
            rel="noopener noreferrer"
          >
            <CalendarPlusIcon />
            Google Calendar
          </Button>
          <Button
            variant="outline"
            href={getIcsDownloadUrl()}
            download="{booking.catalog.name}.ics"
          >
            <CalendarPlusIcon />
            Apple Calendar / Other (.ics)
          </Button>
        </div>
      </Section>

      <Separator />

      <Button
        variant="destructive"
        class="self-start max-sm:w-full"
        onclick={handleCancel}
        disabled={canceling}
      >
        {#if canceling}<Spinner />{:else}<BanIcon />{/if}
        Cancel Booking
      </Button>
    {:else}
      <p class="text-sm text-muted-foreground">
        This booking has been canceled and a refund has been issued.
      </p>
    {/if}
  </div>
{/if}
