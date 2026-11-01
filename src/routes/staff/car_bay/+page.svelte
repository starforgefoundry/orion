<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import QueryState from '$lib/frontend/components/QueryState.svelte';
  import BayWeekCalendar from '$lib/frontend/components/BayWeekCalendar.svelte';
  import IconButton from '$lib/frontend/components/IconButton.svelte';
  import PageHeader from '$lib/frontend/components/PageHeader.svelte';
  import { CAR_BAY_TIER_NAMES } from '$lib/utils/car_bay';
  import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import { StaffBaySchedule } from './staff-bay-schedule.svelte';

  const schedule = new StaffBaySchedule();
</script>

<svelte:window onfocus={() => schedule.refresh()} />

<PageHeader title="Car Bay" formHref="/car_bay">
  {#snippet actions()}
    <Button onclick={() => schedule.openFirstAvailable()}>
      <PlusIcon />
      New Booking
    </Button>
  {/snippet}
</PageHeader>

<div class="flex flex-col gap-3">
  <div class="flex items-center justify-center gap-2">
    <IconButton
      icon={ChevronLeftIcon}
      aria-label="Previous week"
      onclick={() => schedule.previousWeek()}
    />
    <h2 class="w-44 text-center text-sm font-semibold">{schedule.weekLabel}</h2>
    <IconButton
      icon={ChevronRightIcon}
      aria-label="Next week"
      onclick={() => schedule.nextWeek()}
    />
  </div>

  <QueryState query={schedule.policy} label="car bay rules">
    <QueryState query={schedule.schedule} label="car bay schedule">
      {#if schedule.rules}
        <BayWeekCalendar
          rules={schedule.rules}
          days={schedule.days}
          bookings={schedule.bookings}
          closures={schedule.closures}
          isSlotOpen={(date, hour) => schedule.isSlotOpen(date, hour)}
          showDetails
          onSlotClick={(date, hour) => schedule.openNewBooking(date, hour)}
          onClosureClick={(closure) => schedule.reopen(closure)}
          onBookingClick={(booking) => schedule.openBooking(booking.id)}
        >
          {#snippet bookingLabel(booking)}
            <span class="block truncate font-medium">{booking.customerName}</span>
            <span class="block truncate opacity-80">{CAR_BAY_TIER_NAMES[booking.tier]}</span>
          {/snippet}
        </BayWeekCalendar>
      {/if}
    </QueryState>
  </QueryState>
</div>
