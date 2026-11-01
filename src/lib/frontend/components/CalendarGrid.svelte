<script lang="ts" module>
  import { DATE_FORMAT } from '$lib/frontend/format';
  import { monthGridDays } from '$lib/frontend/month-grid';
  import { DateTime } from 'luxon';
  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
  const MAX_MOBILE_DOTS = 3;
</script>

<script lang="ts" generics="T extends { date: string }">
  import IconButton from '$lib/frontend/components/IconButton.svelte';
  import { cn } from '$lib/frontend/cn';
  import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
  import { SPACE_ZONE } from '$lib/space';
  import type { Snippet } from 'svelte';

  interface Props {
    instances: T[];
    filter?: (instance: T) => boolean;
    dayContent: Snippet<
      [{ date: DateTime; dateStr: string; instances: T[]; isCurrentMonth: boolean }]
    >;
  }

  type CalendarDay = { date: DateTime; dateStr: string; isCurrentMonth: boolean; instances: T[] };

  let { instances, filter, dayContent }: Props = $props();

  const today = DateTime.now().setZone(SPACE_ZONE);
  const todayStr = today.toISODate();

  let currentMonth = $state(today);
  let selectedDateStr = $state(todayStr);

  const instancesByDate = $derived.by(() => {
    const map = new Map<string, T[]>();
    for (const inst of instances) {
      if (filter && !filter(inst)) continue;
      const existing = map.get(inst.date) ?? [];
      existing.push(inst);
      map.set(inst.date, existing);
    }
    return map;
  });

  const calendarDays = $derived(
    monthGridDays(currentMonth).map((date): CalendarDay => {
      const dateStr = date.toISODate()!;
      const isCurrentMonth = date.hasSame(currentMonth, 'month');
      const dayInstances = isCurrentMonth ? (instancesByDate.get(dateStr) ?? []) : [];
      return { date, dateStr, isCurrentMonth, instances: dayInstances };
    }),
  );

  const selectedDay = $derived(
    calendarDays.find((d) => d.isCurrentMonth && d.dateStr === selectedDateStr),
  );

  function changeMonth(months: number) {
    currentMonth = currentMonth.plus({ months });
    const isThisMonth = currentMonth.hasSame(today, 'month');
    selectedDateStr = isThisMonth ? todayStr : currentMonth.startOf('month').toISODate()!;
  }
</script>

{#snippet renderDay(calDay: CalendarDay)}
  {@render dayContent({
    date: calDay.date,
    dateStr: calDay.dateStr,
    instances: calDay.instances,
    isCurrentMonth: calDay.isCurrentMonth,
  })}
{/snippet}

<div class="flex flex-col gap-3">
  <div class="flex items-center justify-center gap-2">
    <IconButton
      icon={ChevronLeftIcon}
      aria-label="Previous month"
      onclick={() => changeMonth(-1)}
    />
    <h2 class="w-36 text-center text-sm font-semibold">
      {currentMonth.toFormat(DATE_FORMAT.MONTH_YEAR)}
    </h2>
    <IconButton icon={ChevronRightIcon} aria-label="Next month" onclick={() => changeMonth(1)} />
  </div>

  <div class="overflow-hidden rounded-lg border">
    <div class="grid grid-cols-7 border-b bg-muted/50">
      {#each WEEKDAYS as day (day)}
        <div class="py-1.5 text-center text-xs font-medium text-muted-foreground">
          <span class="md:hidden">{day.charAt(0)}</span>
          <span class="hidden md:inline">{day}</span>
        </div>
      {/each}
    </div>

    <div class="grid grid-cols-7 gap-px bg-border">
      {#each calendarDays as calDay (calDay.dateStr)}
        {@const isSelected = calDay.dateStr === selectedDay?.dateStr}
        {@const isToday = calDay.dateStr === todayStr}
        <div
          class={cn(
            'min-w-0 bg-background md:min-h-24',
            !calDay.isCurrentMonth &&
              'bg-[color-mix(in_oklch,var(--muted)_30%,var(--background))] text-muted-foreground',
          )}
        >
          <button
            type="button"
            class="flex h-12 w-full flex-col items-center justify-center gap-1 disabled:cursor-default md:hidden"
            disabled={!calDay.isCurrentMonth}
            aria-pressed={isSelected}
            aria-label={calDay.date.toFormat(DATE_FORMAT.WEEKDAY_MONTH_DAY)}
            onclick={() => (selectedDateStr = calDay.dateStr)}
          >
            <span
              class={cn(
                'grid size-6 place-items-center rounded-full text-xs',
                isToday && 'font-semibold text-primary',
                isSelected && 'bg-primary text-primary-foreground',
              )}
            >
              {calDay.date.day}
            </span>
            <span class="flex h-1 gap-0.5">
              {#each calDay.instances.slice(0, MAX_MOBILE_DOTS) as _, i (i)}
                <span class="size-1 rounded-full bg-primary"></span>
              {/each}
            </span>
          </button>

          <div class="hidden p-1.5 md:block">
            <div
              class={cn(
                'mb-1 text-xs font-medium text-muted-foreground',
                isToday && 'font-semibold text-primary',
              )}
            >
              {calDay.date.day}
            </div>
            {#if calDay.isCurrentMonth}
              {@render renderDay(calDay)}
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </div>

  {#if selectedDay}
    <div class="flex flex-col gap-2 md:hidden">
      <h3 class="text-sm font-medium">
        {selectedDay.date.toFormat(DATE_FORMAT.WEEKDAY_MONTH_DAY)}
      </h3>
      {#if selectedDay.instances.length === 0}
        <p class="rounded-lg border p-3 text-center text-sm text-muted-foreground">
          Nothing scheduled.
        </p>
      {:else}
        {@render renderDay(selectedDay)}
      {/if}
    </div>
  {/if}
</div>
