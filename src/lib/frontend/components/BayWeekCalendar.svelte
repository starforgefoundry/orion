<script lang="ts" module>
  const HOUR_HEIGHT_PX = 44;
  const MINUTES_IN_HOUR = 60;
  const TURNOVER_LABEL_MIN_PX = 14;

  const UNAVAILABLE_CLASS = 'bay-unavailable';
  const CLOSED_CLASS = 'bay-closed';
  const AVAILABLE_CLASS = 'bay-available hover:text-emerald-800 dark:hover:text-emerald-200';
  const BOOKED_CLASS = 'bg-blue-600 text-white dark:bg-blue-500';
  const TURNOVER_CLASS =
    'border border-t-0 border-dashed border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950 dark:text-blue-200';

  export type BayClosureSlot = {
    id: string;
    startAt: string;
    endAt: string;
    reason?: string | null;
  };
</script>

<script
  lang="ts"
  generics="B extends { id: string; startAt: string; endAt: string; blockedUntil: string }"
>
  import { cn } from '$lib/frontend/cn';
  import {
    CAR_BAY_ZONE,
    formatHour,
    toBlock,
    toPeriod,
    type CarBayRules,
  } from '$lib/utils/car_bay';
  import { DateTime } from 'luxon';
  import type { Snippet } from 'svelte';

  interface Props {
    rules: CarBayRules;
    days: string[];
    bookings: B[];
    closures: BayClosureSlot[];
    isSlotOpen: (date: string, hour: number) => boolean;
    onSlotClick?: (date: string, hour: number) => void;
    onBookingClick?: (booking: B) => void;
    onClosureClick?: (closure: BayClosureSlot) => void;
    bookingLabel?: Snippet<[B]>;
    /** Staff see turnover and closures on their own; customers see each as one unavailable span. */
    showDetails?: boolean;
  }

  let {
    rules,
    days,
    bookings,
    closures,
    isSlotOpen,
    onSlotClick,
    onBookingClick,
    onClosureClick,
    bookingLabel,
    showDetails = false,
  }: Props = $props();

  const firstHour = $derived(rules.earliestOpenHour);
  const rowHours = $derived(
    Array.from({ length: rules.latestCloseHour - firstHour }, (_, i) => firstHour + i),
  );
  const columnHeight = $derived(rowHours.length * HOUR_HEIGHT_PX);
  const now = DateTime.now().setZone(CAR_BAY_ZONE);
  const todayStr = now.toISODate()!;

  function isPastDay(date: string) {
    return date < todayStr;
  }

  function hasEnded(slotStart: DateTime) {
    return slotStart.plus({ hours: 1 }) <= now;
  }

  function offset(time: DateTime) {
    return (time.hour + time.minute / MINUTES_IN_HOUR - firstHour) * HOUR_HEIGHT_PX;
  }

  function bookingSegments(date: string) {
    return bookings.flatMap((booking) => {
      const clipped = rules.clipToDay(toBlock(booking), date);
      if (!clipped) return [];

      const bookedEnd = DateTime.max(
        DateTime.min(toPeriod(booking).endAt, clipped.end),
        clipped.start,
      );
      return [
        {
          booking,
          top: offset(clipped.start),
          bookedHeight: offset(bookedEnd) - offset(clipped.start),
          turnoverHeight: offset(clipped.end) - offset(bookedEnd),
        },
      ];
    });
  }

  function closureSegments(date: string) {
    return closures.flatMap((closure) => {
      const clipped = rules.clipToDay(rules.closureBlock(toPeriod(closure)), date);
      if (!clipped) return [];
      return [
        {
          closure,
          top: offset(clipped.start),
          height: offset(clipped.end) - offset(clipped.start),
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

      <div
        class="{UNAVAILABLE_CLASS} row-start-2"
        style:grid-column="2 / -1"
        aria-hidden="true"
      ></div>

      <div class="relative col-start-1 row-start-2" style:height="{columnHeight}px">
        {#each rowHours as hour, i (hour)}
          <div
            class="absolute right-1.5 -translate-y-1/2 text-[0.625rem] text-muted-foreground first:translate-y-0"
            style:top="{i * HOUR_HEIGHT_PX}px"
          >
            {formatHour(hour)}
          </div>
        {/each}
      </div>

      {#each days as date, i (date)}
        {@const { open } = rules.openWindow(date)}
        <div
          class={cn('relative row-start-2 border-l', isPastDay(date) && 'bg-background')}
          style:grid-column={i + 2}
          style:height="{columnHeight}px"
        >
          {#each rules.slotHours(date) as hour (hour)}
            {@const slotOpen = isSlotOpen(date, hour)}
            {@const slotEnded = hasEnded(open.set({ hour }))}
            <button
              type="button"
              class={cn(
                'absolute inset-x-0 text-[0.625rem] font-medium text-transparent transition-colors',
                slotOpen && `cursor-pointer border-t ${AVAILABLE_CLASS}`,
                !slotOpen && 'cursor-default',
                !slotOpen && slotEnded && 'border-t bg-background',
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

          {#each closureSegments(date) as segment (segment.closure.id)}
            <button
              type="button"
              class={cn(
                'absolute inset-x-0 overflow-hidden text-left disabled:cursor-default',
                showDetails && `${CLOSED_CLASS} inset-x-0.5 rounded-md border`,
              )}
              style:top="{segment.top}px"
              style:height="{segment.height}px"
              disabled={!onClosureClick}
              aria-label="Closed"
              onclick={() => onClosureClick?.(segment.closure)}
            >
              {#if showDetails}
                <span
                  class="m-1 inline-block max-w-[calc(100%-0.5rem)] truncate rounded-sm bg-background px-1 py-0.5 text-[0.625rem] leading-tight font-medium"
                >
                  Closed{segment.closure.reason ? ` · ${segment.closure.reason}` : ''}
                </span>
              {/if}
            </button>
          {/each}

          {#each bookingSegments(date) as segment (segment.booking.id)}
            <button
              type="button"
              class={cn(
                'absolute inset-x-0.5 flex flex-col overflow-hidden rounded-md border border-background text-left disabled:cursor-default',
                !showDetails && BOOKED_CLASS,
              )}
              style:top="{segment.top}px"
              style:height="{segment.bookedHeight + segment.turnoverHeight}px"
              disabled={!onBookingClick}
              onclick={() => onBookingClick?.(segment.booking)}
            >
              <span
                class={cn(
                  'w-full overflow-hidden px-1.5 py-1 text-[0.625rem] leading-tight',
                  showDetails ? `shrink-0 ${BOOKED_CLASS}` : 'flex-1',
                )}
                style:height={showDetails ? `${segment.bookedHeight}px` : undefined}
              >
                {#if bookingLabel}
                  {@render bookingLabel(segment.booking)}
                {:else}
                  Booked
                {/if}
              </span>
              {#if showDetails && segment.turnoverHeight > 0}
                <span
                  class={cn(
                    'flex w-full flex-1 items-center rounded-b-md px-1.5 text-[0.625rem] leading-none',
                    TURNOVER_CLASS,
                  )}
                >
                  {#if segment.turnoverHeight >= TURNOVER_LABEL_MIN_PX}Turnover{/if}
                </span>
              {/if}
            </button>
          {/each}
        </div>
      {/each}
    </div>
  </div>

  <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
    <span class="flex items-center gap-1.5">
      <span class="size-3 rounded-sm border {AVAILABLE_CLASS}"></span> Available
    </span>
    <span class="flex items-center gap-1.5">
      <span class="size-3 rounded-sm {BOOKED_CLASS}"></span> Booked
    </span>
    {#if showDetails}
      <span class="flex items-center gap-1.5">
        <span class="size-3 rounded-sm {TURNOVER_CLASS} border-t"></span> Turnover
      </span>
      <span class="flex items-center gap-1.5">
        <span class="size-3 rounded-sm border {CLOSED_CLASS}"></span> Closed by staff
      </span>
    {/if}
    <span class="flex items-center gap-1.5">
      <span class="size-3 rounded-sm border {UNAVAILABLE_CLASS}"></span> Unavailable
    </span>
  </div>
</div>

<style>
  .bay-unavailable {
    background-image: repeating-linear-gradient(135deg, var(--muted) 0 6px, transparent 6px 12px);
  }

  /* Opaque so the striped layer underneath never shows through an open slot. */
  .bay-available {
    --bay-available-tint: oklch(0.696 0.17 162.48);
    background-color: color-mix(in srgb, var(--bay-available-tint) 8%, var(--background));
  }

  .bay-available:hover {
    background-color: color-mix(in srgb, var(--bay-available-tint) 18%, var(--background));
  }

  .bay-closed {
    border-color: color-mix(in oklch, var(--foreground) 35%, transparent);
    background-color: color-mix(in oklch, var(--foreground) 10%, var(--background));
    background-image: repeating-linear-gradient(
      135deg,
      transparent 0 4px,
      color-mix(in oklch, var(--foreground) 45%, transparent) 4px 6px
    );
  }
</style>
