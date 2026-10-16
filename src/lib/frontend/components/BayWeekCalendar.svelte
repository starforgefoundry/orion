<script lang="ts" module>
  const HOUR_HEIGHT_PX = 44;
  const MINUTES_IN_HOUR = 60;
  const CLOSED_PATTERN =
    'bg-[repeating-linear-gradient(135deg,var(--muted)_0_6px,transparent_6px_12px)]';
</script>

<script lang="ts" generics="B extends { id: string; startAt: string; endAt: string }">
  import { cn } from '$lib/frontend/cn';
  import { CAR_BAY_ZONE, formatHour, toPeriod, type CarBayRules } from '$lib/utils/car_bay';
  import { DateTime } from 'luxon';
  import type { Snippet } from 'svelte';

  interface Props {
    rules: CarBayRules;
    days: string[];
    bookings: B[];
    isSlotOpen: (date: string, hour: number) => boolean;
    onSlotClick?: (date: string, hour: number) => void;
    onBookingClick?: (booking: B) => void;
    bookingLabel?: Snippet<[B]>;
  }

  let { rules, days, bookings, isSlotOpen, onSlotClick, onBookingClick, bookingLabel }: Props =
    $props();

  const firstHour = $derived(rules.earliestOpenHour);
  const rowHours = $derived(
    Array.from({ length: rules.latestCloseHour - firstHour }, (_, i) => firstHour + i),
  );
  const columnHeight = $derived(rowHours.length * HOUR_HEIGHT_PX);
  const todayStr = DateTime.now().setZone(CAR_BAY_ZONE).toISODate();

  function offset(time: DateTime) {
    return (time.hour + time.minute / MINUTES_IN_HOUR - firstHour) * HOUR_HEIGHT_PX;
  }

  function segmentsFor(date: string) {
    return bookings.flatMap((booking) => {
      const period = toPeriod(booking);
      const clipped = rules.clipToDay(period, date);
      if (!clipped) return [];

      const bookedEnd = DateTime.min(period.endAt, clipped.end);
      return [
        {
          booking,
          top: offset(clipped.start),
          bookedHeight: Math.max(offset(bookedEnd) - offset(clipped.start), 0),
          bufferHeight: offset(clipped.end) - offset(DateTime.max(bookedEnd, clipped.start)),
        },
      ];
    });
  }
</script>

<div class="flex flex-col gap-2">
  <div class="overflow-x-auto rounded-lg border">
    <div
      class="grid min-w-[40rem]"
      style:grid-template-columns="3.5rem repeat({days.length}, minmax(0, 1fr))"
    >
      <div class="border-b bg-muted/50"></div>
      {#each days as date (date)}
        {@const day = DateTime.fromISO(date)}
        <div
          class={cn(
            'border-b border-l bg-muted/50 py-1.5 text-center text-xs',
            date === todayStr && 'font-semibold text-primary',
          )}
        >
          <div class="font-medium">{day.toFormat('EEE')}</div>
          <div class="text-muted-foreground">{day.toFormat('MMM d')}</div>
        </div>
      {/each}

      <div class="relative" style:height="{columnHeight}px">
        {#each rowHours as hour, i (hour)}
          <div
            class="absolute right-1.5 -translate-y-1/2 text-[0.625rem] text-muted-foreground first:translate-y-0"
            style:top="{i * HOUR_HEIGHT_PX}px"
          >
            {formatHour(hour)}
          </div>
        {/each}
      </div>

      {#each days as date (date)}
        {@const { open, close } = rules.openWindow(date)}
        <div class="relative border-l" style:height="{columnHeight}px">
          <div
            class="{CLOSED_PATTERN} absolute inset-x-0 top-0"
            style:height="{offset(open)}px"
            aria-hidden="true"
          ></div>
          <div
            class="{CLOSED_PATTERN} absolute inset-x-0 bottom-0"
            style:top="{offset(close)}px"
            aria-hidden="true"
          ></div>

          {#each rules.slotHours(date) as hour (hour)}
            {@const slotOpen = isSlotOpen(date, hour)}
            <button
              type="button"
              class={cn(
                'absolute inset-x-0 border-t text-[0.625rem] text-transparent transition-colors',
                slotOpen
                  ? 'cursor-pointer hover:bg-primary/10 hover:text-primary'
                  : 'cursor-default bg-muted',
              )}
              style:top="{offset(open.set({ hour }))}px"
              style:height="{HOUR_HEIGHT_PX}px"
              disabled={!slotOpen || !onSlotClick}
              aria-label="Book {DateTime.fromISO(date).toFormat('EEEE, MMMM d')} at {formatHour(
                hour,
              )}"
              onclick={() => onSlotClick?.(date, hour)}
            >
              Book
            </button>
          {/each}

          {#each segmentsFor(date) as segment (segment.booking.id)}
            <button
              type="button"
              class="absolute inset-x-0.5 flex flex-col overflow-hidden rounded-md text-left disabled:cursor-default"
              style:top="{segment.top}px"
              style:height="{segment.bookedHeight + segment.bufferHeight}px"
              disabled={!onBookingClick}
              onclick={() => onBookingClick?.(segment.booking)}
            >
              <span
                class="w-full shrink-0 overflow-hidden bg-primary px-1.5 py-1 text-[0.625rem] leading-tight text-primary-foreground"
                style:height="{segment.bookedHeight}px"
              >
                {#if bookingLabel}
                  {@render bookingLabel(segment.booking)}
                {:else}
                  Booked
                {/if}
              </span>
              <span class="w-full flex-1 bg-primary/30" aria-hidden="true"></span>
            </button>
          {/each}
        </div>
      {/each}
    </div>
  </div>

  <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
    <span class="flex items-center gap-1.5">
      <span class="size-3 rounded-sm border bg-background"></span> Open
    </span>
    <span class="flex items-center gap-1.5">
      <span class="size-3 rounded-sm bg-primary"></span> Booked
    </span>
    <span class="flex items-center gap-1.5">
      <span class="size-3 rounded-sm bg-primary/30"></span> Turnover buffer
    </span>
    <span class="flex items-center gap-1.5">
      <span class="size-3 rounded-sm bg-muted"></span> Closed or unavailable
    </span>
  </div>
</div>
