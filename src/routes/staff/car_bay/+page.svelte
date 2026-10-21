<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Spinner } from '$lib/components/ui/spinner';
  import BayWeekCalendar, {
    type BayClosureSlot,
  } from '$lib/frontend/components/BayWeekCalendar.svelte';
  import IconButton from '$lib/frontend/components/IconButton.svelte';
  import PageHeader from '$lib/frontend/components/PageHeader.svelte';
  import { submitWithToast } from '$lib/frontend/form-submit';
  import { modalManager } from '$lib/frontend/modal-manager.svelte';
  import { getCarBayStaffSchedule, reopenCarBay } from '$lib/remotes/endpoints/car_bay.remote';
  import { getCarBayPolicy } from '$lib/remotes/endpoints/settings.remote';
  import {
    CAR_BAY_STATUS,
    CAR_BAY_TIER,
    CAR_BAY_TIER_NAMES,
    CAR_BAY_ZONE,
    CarBayRules,
    consecutiveDates,
    formatPeriod,
    toPeriod,
  } from '$lib/utils/car_bay';
  import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import { DateTime } from 'luxon';
  import BookingDetailModal from './BookingDetailModal.svelte';
  import StaffBookingModal from './StaffBookingModal.svelte';

  const DAYS_IN_WEEK = 7;
  const STAFF = { enforceHorizon: false };

  const today = DateTime.now().setZone(CAR_BAY_ZONE).startOf('day');

  let weekStart = $state(today.startOf('week'));

  const days = $derived(consecutiveDates(weekStart.toISODate()!, DAYS_IN_WEEK));
  const range = $derived({ from: days[0], to: days.at(-1)! });
  const scheduleRemote = $derived(getCarBayStaffSchedule(range));
  const bookings = $derived(
    (scheduleRemote.current?.bookings ?? []).filter(
      (booking) => booking.status === CAR_BAY_STATUS.CONFIRMED,
    ),
  );
  const closures = $derived(scheduleRemote.current?.closures ?? []);
  const policyRemote = getCarBayPolicy();
  const rules = $derived(policyRemote.current && new CarBayRules(policyRemote.current));
  const blocks = $derived(rules ? rules.scheduleBlocks({ bookings, closures }) : []);

  function isSlotOpen(date: string, startHour: number) {
    if (!rules) return false;
    return rules.requestFits(
      { tier: CAR_BAY_TIER.QUICK_JOB, date, startHour },
      blocks,
      DateTime.now(),
      STAFF,
    );
  }

  async function refresh() {
    await getCarBayStaffSchedule(range).refresh();
  }

  function openNewBooking(date: string, startHour: number) {
    if (!rules) return;
    modalManager.show(StaffBookingModal, {
      date,
      startHour,
      blocks: () => blocks,
      rules,
      onBooked: refresh,
    });
  }

  async function reopen(closure: BayClosureSlot) {
    const { startAt, endAt } = toPeriod(closure);
    const confirmed = await modalManager.confirm({
      title: 'Reopen Car Bay',
      prompt: `Remove the closure on ${formatPeriod({ startAt, endAt })}? Customers can book this time again.`,
      confirmText: 'Reopen',
    });
    if (!confirmed) return;

    const ok = await submitWithToast(() => reopenCarBay({ closureId: closure.id }), {
      success: 'Bay reopened',
      error: 'Failed to reopen the bay',
    });
    if (ok) await refresh();
  }

  function openFirstAvailable() {
    const date = today.toISODate()!;
    if (!rules) return;
    openNewBooking(date, rules.slotHours(date)[0]);
  }
</script>

<svelte:window onfocus={refresh} />

<PageHeader title="Car Bay" formHref="/car_bay">
  {#snippet actions()}
    <Button onclick={openFirstAvailable}>
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
      onclick={() => (weekStart = weekStart.minus({ weeks: 1 }))}
    />
    <h2 class="w-44 text-center text-sm font-semibold">
      {weekStart.toFormat('MMM d')} – {weekStart
        .plus({ days: DAYS_IN_WEEK - 1 })
        .toFormat('MMM d, yyyy')}
    </h2>
    <IconButton
      icon={ChevronRightIcon}
      aria-label="Next week"
      onclick={() => (weekStart = weekStart.plus({ weeks: 1 }))}
    />
  </div>

  {#if (scheduleRemote.loading && !scheduleRemote.current) || !rules}
    <div class="flex justify-center py-10">
      <Spinner class="size-6" />
    </div>
  {:else}
    <BayWeekCalendar
      {rules}
      {days}
      {bookings}
      {closures}
      {isSlotOpen}
      showDetails
      onSlotClick={openNewBooking}
      onClosureClick={reopen}
      onBookingClick={(booking) =>
        modalManager.show(BookingDetailModal, {
          bookingId: booking.id,
          refundCutoffHours: rules.policy.refundCutoffHours,
          onChanged: refresh,
        })}
    >
      {#snippet bookingLabel(booking)}
        <span class="block truncate font-medium">{booking.customerName}</span>
        <span class="block truncate opacity-80">{CAR_BAY_TIER_NAMES[booking.tier]}</span>
      {/snippet}
    </BayWeekCalendar>
  {/if}
</div>
