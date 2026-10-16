<script lang="ts" module>
  import { CAR_BAY_TIER, type CarBayTier } from '$lib/utils/car_bay';

  const TIER_COPY: Record<CarBayTier, string> = {
    [CAR_BAY_TIER.QUICK_JOB]:
      'Great for an oil change, brake jobs, or other quick maintenance items.',
    [CAR_BAY_TIER.HOURLY]:
      "In our experience, it's nearly impossible to estimate how long a job will take. A good rule of thumb is to book 2.5–3x the time you expect the job to take.",
    [CAR_BAY_TIER.FULL_DAY]: 'Recommended if you think your job will take longer than 3.5 hours.',
  };
</script>

<script lang="ts">
  import * as Card from '$lib/components/ui/card';
  import { Spinner } from '$lib/components/ui/spinner';
  import { cn } from '$lib/frontend/cn';
  import BayWeekCalendar from '$lib/frontend/components/BayWeekCalendar.svelte';
  import { modalManager } from '$lib/frontend/modal-manager.svelte';
  import { getCarBaySchedule } from '$lib/remotes/endpoints/car_bay.remote';
  import { getCarBayRates } from '$lib/remotes/endpoints/settings.remote';
  import {
    CAR_BAY_PUBLIC_HORIZON_DAYS,
    CAR_BAY_TIER_NAMES,
    HOURLY_MIN_HOURS,
    QUICK_JOB_MINUTES,
    consecutiveDates,
    formatDollars,
    requestFits,
    toPeriod,
    type CarBayRates,
    type CarBayRequest,
  } from '$lib/utils/car_bay';
  import { DateTime } from 'luxon';
  import CheckoutModal from './CheckoutModal.svelte';

  const scheduleRemote = getCarBaySchedule();
  const ratesRemote = getCarBayRates();

  const schedule = $derived(scheduleRemote.current);
  const rates = $derived(ratesRemote.current);
  const periods = $derived((schedule?.bookings ?? []).map(toPeriod));
  const days = $derived(
    schedule ? consecutiveDates(schedule.today, CAR_BAY_PUBLIC_HORIZON_DAYS + 1) : [],
  );

  const SELECT_KEYS = ['Enter', ' '];

  let tier = $state<CarBayTier>(CAR_BAY_TIER.QUICK_JOB);

  function selectWithKeyboard(event: KeyboardEvent, option: CarBayTier) {
    if (!SELECT_KEYS.includes(event.key)) return;
    event.preventDefault();
    tier = option;
  }
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

  function priceLines(rates: CarBayRates): Record<CarBayTier, string[]> {
    return {
      [CAR_BAY_TIER.QUICK_JOB]: [
        `${formatDollars(rates.quickJob.member)} member`,
        `${formatDollars(rates.quickJob.nonMember)} non-member`,
      ],
      [CAR_BAY_TIER.HOURLY]: [
        `${formatDollars(rates.hourly.member)}/hr member`,
        `${formatDollars(rates.hourly.nonMember)}/hr non-member`,
      ],
      [CAR_BAY_TIER.FULL_DAY]: [
        `Weekday ${formatDollars(rates.fullDayWeekday.member)} member · ${formatDollars(rates.fullDayWeekday.nonMember)} non-member`,
        `Weekend ${formatDollars(rates.fullDayWeekend.member)} member · ${formatDollars(rates.fullDayWeekend.nonMember)} non-member`,
      ],
    };
  }

  const TIER_DURATION: Record<CarBayTier, string> = {
    [CAR_BAY_TIER.QUICK_JOB]: `${QUICK_JOB_MINUTES} minutes`,
    [CAR_BAY_TIER.HOURLY]: `${HOURLY_MIN_HOURS} hour minimum, whole hours`,
    [CAR_BAY_TIER.FULL_DAY]: 'The whole open window, 1–3 days',
  };
</script>

<svelte:window onfocus={() => getCarBaySchedule().refresh()} />

<svelte:head>
  <title>Car Bay Booking - Starforge</title>
</svelte:head>

{#if scheduleRemote.loading || ratesRemote.loading}
  <Spinner class="mx-auto mt-12 size-8" />
{:else if !schedule || !rates}
  <p class="rounded-lg border p-6 text-center text-sm text-destructive">
    Car bay booking is unavailable right now. Please try again later.
  </p>
{:else}
  {@const prices = priceLines(rates)}
  <div class="flex flex-col gap-6">
    <p class="text-sm text-muted-foreground">
      One bay with a vehicle lift. Open Monday to Friday 4 PM – 9 PM and Saturday and Sunday 12 PM –
      9 PM. Pick a booking type, then an open time on the calendar.
    </p>

    <div class="grid gap-3 md:grid-cols-3" role="radiogroup" aria-label="Booking type">
      {#each Object.values(CAR_BAY_TIER) as option (option)}
        <Card.Root
          size="sm"
          role="radio"
          tabindex={0}
          aria-checked={tier === option}
          class={cn(
            'h-full cursor-pointer transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
            tier === option && 'ring-2 ring-primary',
          )}
          onclick={() => (tier = option)}
          onkeydown={(event) => selectWithKeyboard(event, option)}
        >
          <Card.Header>
            <Card.Title>{CAR_BAY_TIER_NAMES[option]}</Card.Title>
            <Card.Description>{TIER_DURATION[option]}</Card.Description>
          </Card.Header>
          <Card.Content class="flex flex-col gap-2 text-sm">
            <div class="font-medium">
              {#each prices[option] as line (line)}
                <p>{line}</p>
              {/each}
            </div>
            <p class="text-muted-foreground">{TIER_COPY[option]}</p>
          </Card.Content>
        </Card.Root>
      {/each}
    </div>

    <BayWeekCalendar {days} bookings={schedule.bookings} {isSlotOpen} onSlotClick={openCheckout} />

    <div class="flex flex-col gap-2 rounded-lg border bg-muted/50 p-4 text-sm">
      <p>Need to book more than a week in advance? Reach out to us through our website.</p>
      <p>
        You may move your own vehicle outside at the end of your reservation at no charge — but it
        may only be stored on the property for up to 3 days from your booking's start date.
      </p>
    </div>
  </div>
{/if}
