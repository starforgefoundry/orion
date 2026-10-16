<script lang="ts">
  import { page } from '$app/state';
  import { Spinner } from '$lib/components/ui/spinner';
  import BayWeekCalendar from '$lib/frontend/components/BayWeekCalendar.svelte';
  import { modalManager } from '$lib/frontend/modal-manager.svelte';
  import { getCarBaySchedule } from '$lib/remotes/endpoints/car_bay.remote';
  import { getCarBayRates } from '$lib/remotes/endpoints/settings.remote';
  import {
    CAR_BAY_PUBLIC_HORIZON_DAYS,
    CAR_BAY_TIER,
    CAR_BAY_TIER_NAMES,
    FULL_DAY_MAX_DAYS,
    HOURLY_MIN_HOURS,
    consecutiveDates,
    requestFits,
    toPeriod,
    type CarBayRequest,
    type CarBayTier,
  } from '$lib/utils/car_bay';
  import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
  import { DateTime } from 'luxon';
  import CheckoutModal from '../CheckoutModal.svelte';
  import PolicyNotes from '../PolicyNotes.svelte';
  import TierPrices from '../TierPrices.svelte';
  import { TIER_DETAILS, priceRows } from '../tiers';

  const tier = $derived(page.params.tier as CarBayTier);
  const details = $derived(TIER_DETAILS[tier]);

  const scheduleRemote = getCarBaySchedule();
  const ratesRemote = getCarBayRates();

  const schedule = $derived(scheduleRemote.current);
  const rates = $derived(ratesRemote.current);
  const periods = $derived((schedule?.bookings ?? []).map(toPeriod));
  const days = $derived(
    schedule ? consecutiveDates(schedule.today, CAR_BAY_PUBLIC_HORIZON_DAYS + 1) : [],
  );

  function shortestRequest(date: string, startHour: number): CarBayRequest {
    if (tier === CAR_BAY_TIER.QUICK_JOB) return { tier, date, startHour };
    if (tier === CAR_BAY_TIER.HOURLY) return { tier, date, startHour, hours: HOURLY_MIN_HOURS };
    return { tier, date, days: 1 };
  }

  function isSlotOpen(date: string, startHour: number) {
    return requestFits(shortestRequest(date, startHour), periods, DateTime.now(), {
      enforceHorizon: true,
    });
  }

  function openCheckout(date: string, startHour: number) {
    if (!rates) return;
    modalManager.show(CheckoutModal, {
      tier,
      date,
      startHour,
      bookings: () => periods,
      rates,
      onUnavailable: () => getCarBaySchedule().refresh(),
    });
  }
</script>

<svelte:window onfocus={() => getCarBaySchedule().refresh()} />

<svelte:head>
  <title>{CAR_BAY_TIER_NAMES[tier]} - Car Bay Booking - Starforge</title>
</svelte:head>

<div class="flex flex-col gap-6">
  <a
    href="/car_bay"
    class="flex items-center gap-1.5 self-start text-sm text-muted-foreground hover:text-foreground"
  >
    <ArrowLeftIcon class="size-4" />
    All booking types
  </a>

  {#if scheduleRemote.loading || ratesRemote.loading}
    <Spinner class="mx-auto mt-12 size-8" />
  {:else if !schedule || !rates}
    <p class="rounded-lg border p-6 text-center text-sm text-destructive">
      Booking isn't available right now. Try again later.
    </p>
  {:else}
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div class="flex items-center gap-3">
        <span
          class="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"
        >
          <details.icon class="size-5" />
        </span>
        <div>
          <h2 class="text-xl font-semibold">{CAR_BAY_TIER_NAMES[tier]}</h2>
          <p class="text-sm text-muted-foreground">{details.duration}</p>
        </div>
      </div>
      <div class="sm:w-72">
        <TierPrices rows={priceRows(rates, tier)} />
      </div>
    </div>

    <p class="text-sm text-muted-foreground">
      {tier === CAR_BAY_TIER.FULL_DAY
        ? `Click any open day to book it. You can add up to ${FULL_DAY_MAX_DAYS - 1} more days at checkout.`
        : 'Click an open hour to start your booking there.'}
    </p>

    <BayWeekCalendar {days} bookings={schedule.bookings} {isSlotOpen} onSlotClick={openCheckout} />

    <PolicyNotes />
  {/if}
</div>
