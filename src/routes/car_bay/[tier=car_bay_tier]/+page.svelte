<script lang="ts">
  import { page } from '$app/state';
  import { Spinner } from '$lib/components/ui/spinner';
  import BayWeekCalendar from '$lib/frontend/components/BayWeekCalendar.svelte';
  import { CAR_BAY_TIER, CAR_BAY_TIER_NAMES, type CarBayTier } from '$lib/utils/car-bay';
  import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
  import ClosedNotice from '../ClosedNotice.svelte';
  import DayPicker from '../DayPicker.svelte';
  import ContactLine from '../ContactLine.svelte';
  import TierPrices from '../TierPrices.svelte';
  import { priceRows } from '../tiers';
  import { TierSchedule } from './tier-schedule.svelte';

  const view = new TierSchedule(() => page.params.tier as CarBayTier);
  const tier = $derived(view.tier);
</script>

<svelte:window onfocus={() => view.refresh()} />

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

  {#if view.loading}
    <Spinner class="mx-auto mt-12 size-8" />
  {:else if view.closed}
    <ClosedNotice />
  {:else if !view.schedule || !view.rates || !view.policy || !view.rules || !view.details}
    <p class="rounded-lg border p-6 text-center text-sm text-destructive">
      Booking isn't available right now. Try again later.
    </p>
  {:else}
    {@const schedule = view.schedule}
    {@const rates = view.rates}
    {@const policy = view.policy}
    {@const rules = view.rules}
    {@const details = view.details}
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
      {#if tier !== CAR_BAY_TIER.FULL_DAY}
        Click an open hour to start your booking there.
      {:else if policy.fullDayMaxDays > 1}
        Click any open day to book it. You can add up to {policy.fullDayMaxDays - 1} more days at checkout.
      {:else}
        Click any open day to book it.
      {/if}
    </p>

    {#if tier === CAR_BAY_TIER.FULL_DAY}
      <DayPicker
        {rules}
        {rates}
        days={view.days}
        blocks={view.blocks}
        isDayOpen={(date) => view.isDayOpen(date)}
        onDayClick={(date) => view.openDay(date)}
      />
    {:else}
      <BayWeekCalendar
        {rules}
        days={view.days}
        bookings={schedule.bookings}
        closures={schedule.closures}
        isSlotOpen={(date, hour) => view.isSlotOpen(date, hour)}
        onSlotClick={(date, hour) => view.openCheckout(date, hour)}
      />
    {/if}

    <ContactLine />
  {/if}
</div>
