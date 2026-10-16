<script lang="ts" module>
  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
  const MAX_MOBILE_DOTS = 3;
</script>

<script lang="ts" generics="T extends { date: string }">
  import IconButton from '$lib/frontend/components/IconButton.svelte';
  import { cn } from '$lib/frontend/cn';
  import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
  import { DateTime } from 'luxon';
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

  const todayStr = DateTime.now().toISODate();

  let currentMonth = $state(DateTime.now());
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

  const calendarDays = $derived.by(() => {
    const start = currentMonth.startOf('month');
    const end = currentMonth.endOf('month');
    const startWeekday = start.weekday % 7;
    const days: CalendarDay[] = [];

    for (let i = 0; i < startWeekday; i++) {
      const date = start.minus({ days: startWeekday - i });
      days.push({ date, dateStr: date.toISODate()!, isCurrentMonth: false, instances: [] });
    }

    for (let i = 0; i < end.day; i++) {
      const date = start.plus({ days: i });
      const dateStr = date.toISODate()!;
      days.push({
        date,
        dateStr,
        isCurrentMonth: true,
        instances: instancesByDate.get(dateStr) ?? [],
      });
    }

    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
      for (let i = 0; i < remaining; i++) {
        const date = end.plus({ days: i + 1 });
        days.push({ date, dateStr: date.toISODate()!, isCurrentMonth: false, instances: [] });
      }
    }

    return days;
  });

  const selectedDay = $derived(
    calendarDays.find((d) => d.isCurrentMonth && d.dateStr === selectedDateStr),
  );

  function changeMonth(months: number) {
    currentMonth = currentMonth.plus({ months });
    const isThisMonth = currentMonth.hasSame(DateTime.now(), 'month');
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
    <h2 class="w-36 text-center text-sm font-semibold">{currentMonth.toFormat('MMMM yyyy')}</h2>
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
            aria-label={calDay.date.toFormat('EEEE, MMMM d')}
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
      <h3 class="text-sm font-medium">{selectedDay.date.toFormat('EEEE, MMMM d')}</h3>
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
