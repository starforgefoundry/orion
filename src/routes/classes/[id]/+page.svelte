<script lang="ts">
  import { page } from '$app/state';
  import { Button } from '$lib/components/ui/button';
  import { Spinner } from '$lib/components/ui/spinner';
  import { cn } from '$lib/frontend/cn';
  import CalendarGrid from '$lib/frontend/components/CalendarGrid.svelte';
  import Section from '$lib/frontend/components/Section.svelte';
  import StatusBadge from '$lib/frontend/components/StatusBadge.svelte';
  import { modalManager } from '$lib/frontend/modal-manager.svelte';
  import { formatTime } from '$lib/frontend/utils';
  import { getCatalogById, getClassInstances } from '$lib/remotes/endpoints/class.remote';
  import { DateTime } from 'luxon';
  import BookingModal from './BookingModal.svelte';

  const classId = page.params.id ?? '';
  const now = DateTime.now().setZone('America/Chicago');
  const catalogRemote = $derived(getCatalogById(classId));
  const catalog = $derived(catalogRemote.current);
  const instancesRemote = $derived(getClassInstances(classId));
  const instances = $derived(instancesRemote.current ?? []);

  function bookInstance(inst: (typeof instances)[0]) {
    if (!catalog) return;

    modalManager.show(BookingModal, {
      catalogName: catalog.name,
      price: catalog.price,
      instanceId: inst.id,
      date: inst.date,
      startTime: inst.startTime,
      durationMinutes: inst.durationMinutes,
      availableSpots: inst.seats - inst.confirmedCount,
    });
  }
</script>

<svelte:head>
  <title>{catalog?.name ?? 'Class Details'} - Starforge</title>
</svelte:head>

{#if catalogRemote.loading}
  <Spinner class="mx-auto mt-12 size-8" />
{:else if !catalog}
  <p class="rounded-lg border p-6 text-center text-sm font-medium text-destructive">
    Class not found.
  </p>
{:else}
  <div class="flex flex-col gap-4">
    {#if catalog.photoUrl}
      <img
        src={catalog.photoUrl}
        alt={catalog.name}
        class="h-44 w-full rounded-lg object-cover sm:h-64"
      />
    {/if}

    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h2 class="text-xl font-semibold">{catalog.name}</h2>
        <p class="mt-1 text-sm text-muted-foreground">{catalog.description}</p>
      </div>
      <StatusBadge tone="success" class="shrink-0 text-sm">
        ${(catalog.price / 100).toFixed(2)}
      </StatusBadge>
    </div>

    <Section title="Select a Date">
      {#snippet actions()}
        <div class="flex gap-3 pr-2 text-xs text-muted-foreground">
          <span class="flex items-center gap-1">
            <span class="inline-block size-2.5 rounded-sm bg-success/40"></span> Available
          </span>
          <span class="flex items-center gap-1">
            <span class="inline-block size-2.5 rounded-sm bg-destructive/40"></span> Full
          </span>
        </div>
      {/snippet}
      {#if instancesRemote.loading}
        <div class="flex min-h-64 items-center justify-center">
          <Spinner class="size-8" />
        </div>
      {:else}
        <CalendarGrid {instances}>
          {#snippet dayContent({ instances: dayInstances, isCurrentMonth })}
            {#if dayInstances.length > 0 && isCurrentMonth}
              <div class="flex flex-col gap-1.5">
                {#each dayInstances as inst}
                  {@const spotsLeft = inst.seats - inst.confirmedCount}
                  {@const isPast =
                    DateTime.fromISO(`${inst.date}T${inst.startTime}`, {
                      zone: 'America/Chicago',
                    }) < now}
                  {@const isAvailable = spotsLeft > 0 && !isPast}
                  <div
                    class={cn(
                      'flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md p-1.5 text-xs',
                      isPast
                        ? 'bg-muted text-muted-foreground'
                        : isAvailable
                          ? 'bg-success/15 text-success'
                          : 'bg-destructive/15 text-destructive',
                    )}
                  >
                    <div class="min-w-0 flex-1">
                      <div class="text-sm font-medium">{formatTime(inst.startTime)}</div>
                      <div class="opacity-80">
                        {isPast ? '(past)' : `(${spotsLeft} spots)`}
                      </div>
                    </div>
                    {#if isAvailable}
                      <Button
                        size="xs"
                        variant="outline"
                        class="md:w-full"
                        onclick={() => bookInstance(inst)}
                      >
                        Book
                      </Button>
                    {/if}
                  </div>
                {/each}
              </div>
            {/if}
          {/snippet}
        </CalendarGrid>
      {/if}
    </Section>
  </div>
{/if}
