<script lang="ts" generics="T extends { date: string }">
  import { Button, Heading, HStack } from '@immich/ui';
  import { mdiChevronLeft, mdiChevronRight } from '@mdi/js';
  import { DateTime } from 'luxon';
  import type { Snippet } from 'svelte';

  interface Props {
    instances: T[];
    filter?: (instance: T) => boolean;
    dayContent: Snippet<[{ date: DateTime; dateStr: string; instances: T[]; isCurrentMonth: boolean }]>;
  }

  let { instances, filter, dayContent }: Props = $props();

  let currentMonth = $state(DateTime.now());

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
    const days: { date: DateTime; dateStr: string; isCurrentMonth: boolean; instances: T[] }[] = [];

    for (let i = 0; i < startWeekday; i++) {
      const date = start.minus({ days: startWeekday - i });
      days.push({ date, dateStr: date.toISODate()!, isCurrentMonth: false, instances: [] });
    }

    for (let i = 0; i < end.day; i++) {
      const date = start.plus({ days: i });
      const dateStr = date.toISODate()!;
      days.push({ date, dateStr, isCurrentMonth: true, instances: instancesByDate.get(dateStr) ?? [] });
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

  /** Days in current month that have instances (for mobile list view) */
  const daysWithInstances = $derived(
    calendarDays.filter((d) => d.isCurrentMonth && d.instances.length > 0),
  );
</script>

<div class="flex flex-col gap-4">
  <HStack class="items-center justify-center gap-4">
    <Button size="small" variant="ghost" leadingIcon={mdiChevronLeft} onclick={() => (currentMonth = currentMonth.minus({ months: 1 }))} />
    <Heading size="small">{currentMonth.toFormat('MMMM yyyy')}</Heading>
    <Button size="small" variant="ghost" leadingIcon={mdiChevronRight} onclick={() => (currentMonth = currentMonth.plus({ months: 1 }))} />
  </HStack>

  <!-- Desktop: grid view -->
  <div class="hidden overflow-hidden rounded-lg border border-gray-700 md:block">
    <div class="grid grid-cols-7 border-b border-gray-700">
      {#each ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as day}
        <div class="p-2 text-center text-xs font-semibold text-gray-400">{day}</div>
      {/each}
    </div>

    <div class="grid grid-cols-7 -m-px">
      {#each calendarDays as calDay}
        <div class="min-h-24 border border-gray-700 p-1.5 {calDay.isCurrentMonth ? '' : 'bg-gray-900/50 text-gray-600'}">
          <div class="mb-1 text-left text-xs font-medium {calDay.isCurrentMonth ? 'text-gray-400' : 'text-gray-600'}">
            {calDay.date.day}
          </div>
          {#if calDay.isCurrentMonth}
            {@render dayContent({ date: calDay.date, dateStr: calDay.dateStr, instances: calDay.instances, isCurrentMonth: calDay.isCurrentMonth })}
          {/if}
        </div>
      {/each}
    </div>
  </div>

  <!-- Mobile: list view -->
  <div class="flex flex-col gap-2 md:hidden">
    {#if daysWithInstances.length === 0}
      <div class="rounded-lg border border-gray-700 p-4 text-center text-sm text-gray-400">
        No classes this month.
      </div>
    {:else}
      {#each daysWithInstances as calDay}
        <div class="rounded-lg border border-gray-700 p-3">
          <div class="mb-2 text-sm font-semibold text-gray-300">
            {calDay.date.toFormat('EEEE, MMMM d')}
          </div>
          {@render dayContent({ date: calDay.date, dateStr: calDay.dateStr, instances: calDay.instances, isCurrentMonth: true })}
        </div>
      {/each}
    {/if}
  </div>
</div>
