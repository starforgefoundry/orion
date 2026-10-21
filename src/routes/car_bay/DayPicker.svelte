<script lang="ts">
  import StatusBadge from '$lib/frontend/components/StatusBadge.svelte';
  import { cn } from '$lib/frontend/cn';
  import {
    CAR_BAY_ZONE,
    formatDollars,
    isWeekend,
    type CarBayBlock,
    type CarBayRates,
    type CarBayRules,
  } from '$lib/utils/car_bay';
  import { DateTime } from 'luxon';

  interface Props {
    rules: CarBayRules;
    rates: CarBayRates;
    days: string[];
    blocks: CarBayBlock[];
    isDayOpen: (date: string) => boolean;
    onDayClick: (date: string) => void;
  }

  let { rules, rates, days, blocks, isDayOpen, onDayClick }: Props = $props();

  const todayStr = DateTime.now().setZone(CAR_BAY_ZONE).toISODate();

  function hoursLabel(date: string) {
    const { open, close } = rules.openWindow(date);
    return `${open.toFormat('h a')} – ${close.toFormat('h a')}`;
  }

  function isBooked(date: string) {
    return blocks.some((block) => rules.clipToDay(block, date) !== null);
  }

  function price(date: string) {
    const pair = isWeekend(date) ? rates.fullDayWeekend : rates.fullDayWeekday;
    return `Member ${formatDollars(pair.member)} · Non-member ${formatDollars(pair.nonMember)}`;
  }
</script>

<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
  {#each days as date (date)}
    {@const day = DateTime.fromISO(date)}
    {@const open = isDayOpen(date)}
    <button
      type="button"
      disabled={!open}
      onclick={() => onDayClick(date)}
      class={cn(
        'flex flex-col gap-2 rounded-xl border p-4 text-left transition-all outline-none',
        open
          ? 'cursor-pointer bg-card shadow-xs hover:-translate-y-0.5 hover:border-primary hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50'
          : 'cursor-default bg-muted/50 text-muted-foreground',
      )}
    >
      <div class="flex items-start justify-between gap-2">
        <div>
          <p class={cn('text-xs font-medium', date === todayStr && 'text-primary')}>
            {date === todayStr ? 'Today' : day.toFormat('EEEE')}
          </p>
          <p class="text-lg font-semibold">{day.toFormat('MMM d')}</p>
        </div>
        {#if open}
          <StatusBadge tone="success">Open</StatusBadge>
        {:else if isBooked(date)}
          <StatusBadge tone="info">Booked</StatusBadge>
        {:else}
          <StatusBadge>Closed</StatusBadge>
        {/if}
      </div>
      <p class="text-sm">{hoursLabel(date)}</p>
      <p class="text-xs text-muted-foreground">{price(date)}</p>
    </button>
  {/each}
</div>
