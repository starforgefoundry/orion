<script lang="ts">
  import { page } from '$app/state';
  import { formatTime } from '$lib/frontend/utils';
  import { cancelBooking, getBookingByToken } from '$lib/remotes/endpoints/class.remote';
  import {
    Badge,
    Button,
    Card,
    CardBody,
    CardHeader,
    CardTitle,
    Heading,
    HStack,
    Icon,
    LoadingSpinner,
    modalManager,
    Stack,
    Text,
  } from '@immich/ui';
  import { mdiCalendarPlus, mdiCancel, mdiCheck, mdiHelp } from '@mdi/js';
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
    const confirmed = await modalManager.showDialog({
      title: 'Cancel Booking',
      prompt: 'Are you sure you want to cancel this booking? You will receive a full refund.',
      confirmText: 'Cancel Booking',
      confirmColor: 'danger',
      icon: mdiHelp,
    });

    if (!confirmed) return;

    canceling = true;
    try {
      await cancelBooking({ bookingToken: token });
      await getBookingByToken(token).refresh();
    } catch (error: any) {
      modalManager.showDialog({
        title: 'Error',
        prompt: error?.message ?? 'Failed to cancel booking',
        confirmText: 'OK',
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
  <LoadingSpinner class="mx-auto mt-12" size="large" />
{:else if !booking || !booking.instance || !booking.catalog}
  <Card>
    <CardBody>
      <Text color="danger" fontWeight="bold">Booking not found.</Text>
      <Text class="mt-2">This booking may not exist or the link may be invalid.</Text>
    </CardBody>
  </Card>
{:else}
  <Stack gap={6}>
    <Card>
      <CardHeader>
        <HStack class="items-center gap-3">
          <Icon icon={booking.status === 'confirmed' ? mdiCheck : mdiCancel} size="1.5rem" />
          <CardTitle>
            {booking.status === 'confirmed' ? 'Booking Confirmed' : 'Booking Canceled'}
          </CardTitle>
        </HStack>
      </CardHeader>
      <CardBody>
        <Stack gap={4}>
          <Badge color={booking.status === 'confirmed' ? 'success' : 'danger'} class="self-start">
            {booking.status === 'confirmed' ? 'Confirmed' : 'Canceled'}
          </Badge>

          <Heading size="small">{booking.catalog.name}</Heading>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Text color="muted" size="small">Date</Text>
              <Text fontWeight="bold">
                {getBookingDate()}
              </Text>
            </div>
            <div>
              <Text color="muted" size="small">Time</Text>
              <Text fontWeight="bold">
                {formatTime(booking.instance.startTime)} ({booking.instance.durationMinutes} min)
              </Text>
            </div>
            <div>
              <Text color="muted" size="small">Name</Text>
              <Text fontWeight="bold">{booking.customerName}</Text>
            </div>
            <div>
              <Text color="muted" size="small">Email</Text>
              <Text fontWeight="bold">{booking.customerEmail}</Text>
            </div>
            <div>
              <Text color="muted" size="small">Spots</Text>
              <Text fontWeight="bold">{booking.quantity ?? 1}</Text>
            </div>
            <div>
              <Text color="muted" size="small">Amount Paid</Text>
              <Text fontWeight="bold">${(booking.amountPaid / 100).toFixed(2)}</Text>
            </div>
          </div>

          {#if booking.status === 'confirmed'}
            <Stack gap={2} class="mt-4">
              <Heading size="small">Add to Calendar</Heading>
              <HStack gap={2} class="flex-wrap">
                <a href={getGoogleCalendarUrl()} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" leadingIcon={mdiCalendarPlus}>Google Calendar</Button>
                </a>
                <a href={getIcsDownloadUrl()} download="{booking.catalog.name}.ics">
                  <Button variant="outline" leadingIcon={mdiCalendarPlus}>
                    Apple Calendar / Other (.ics)
                  </Button>
                </a>
              </HStack>
            </Stack>

            <hr />

            <div class="mt">
              <Button
                color="danger"
                variant="outline"
                leadingIcon={mdiCancel}
                onclick={handleCancel}
                loading={canceling}
              >
                Cancel Booking
              </Button>
            </div>
          {/if}

          {#if booking.status === 'canceled'}
            <Text color="muted" class="mt-2">
              This booking has been canceled and a refund has been issued.
            </Text>
          {/if}
        </Stack>
      </CardBody>
    </Card>
  </Stack>
{/if}
