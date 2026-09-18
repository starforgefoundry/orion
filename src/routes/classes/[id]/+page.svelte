<script lang="ts">
  import { page } from '$app/state';
  import CalendarGrid from '$lib/frontend/components/CalendarGrid.svelte';
  import { formatTime } from '$lib/frontend/utils';
  import { getCatalogById, getClassInstances } from '$lib/remotes/endpoints/class.remote';
  import {
    Badge,
    Button,
    Card,
    CardBody,
    CardHeader,
    CardTitle,
    Heading,
    LoadingSpinner,
    modalManager,
    Stack,
    Text,
  } from '@immich/ui';
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
  <LoadingSpinner class="mx-auto mt-12" size="large" />
{:else if !catalog}
  <Card>
    <CardBody>
      <Text color="danger" fontWeight="bold">Class not found.</Text>
    </CardBody>
  </Card>
{:else}
  <Stack gap={6}>
    {#if catalog.photoUrl}
      <div class="h-64 w-full overflow-hidden rounded-xl">
        <img src={catalog.photoUrl} alt={catalog.name} class="h-full w-full object-cover" />
      </div>
    {/if}

    <div class="flex flex-row justify-between">
      <div>
        <Heading size="large">{catalog.name}</Heading>
        <Text class="mt-2" color="muted">{catalog.description}</Text>
      </div>
      <Badge color="success" class="self-start" size="large">
        ${(catalog.price / 100).toFixed(2)}
      </Badge>
    </div>

    <!-- Calendar -->
    <Card>
      <CardHeader>
        <div class="flex items-center justify-between gap-2">
          <CardTitle>Select a Date</CardTitle>
          <div class="flex gap-4 text-xs text-gray-400">
            <span class="flex items-center gap-1">
              <span class="inline-block h-3 w-3 rounded bg-green-600/40"></span> Available
            </span>
            <span class="flex items-center gap-1">
              <span class="inline-block h-3 w-3 rounded bg-red-600/40"></span> Full
            </span>
          </div>
        </div>
      </CardHeader>
      <CardBody>
        {#if instancesRemote.loading}
          <div class="flex min-h-64 items-center justify-center">
            <LoadingSpinner size="large" />
          </div>
        {:else}
          <CalendarGrid {instances}>
            {#snippet dayContent({ instances: dayInstances, isCurrentMonth })}
              {@const hasInstances = dayInstances.length > 0}
              {#if hasInstances && isCurrentMonth}
                <div class="flex flex-col gap-2">
                  {#each dayInstances as inst}
                    {@const spotsLeft = inst.seats - inst.confirmedCount}
                    {@const isPast =
                      DateTime.fromISO(`${inst.date}T${inst.startTime}`, {
                        zone: 'America/Chicago',
                      }) < now}
                    {@const isAvailable = spotsLeft > 0 && !isPast}
                    <div
                      class="w-full rounded p-2
                    {isPast
                        ? 'bg-gray-800/40 text-gray-500'
                        : isAvailable
                          ? 'bg-green-900/20 text-green-400'
                          : 'bg-red-900/20 text-red-400'}"
                    >
                      <div>
                        <Text>{formatTime(inst.startTime)}</Text>

                        <Text class="text-xs" color="muted">
                          {#if isPast}
                            (past)
                          {:else}
                            ({spotsLeft} spots)
                          {/if}
                        </Text>

                        {#if isAvailable}
                          <Button
                            size="tiny"
                            fullWidth
                            onclick={() => bookInstance(inst)}
                            class="mt-2"
                            variant="outline"
                            color="success"
                          >
                            Book
                          </Button>
                        {/if}
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}
            {/snippet}
          </CalendarGrid>
        {/if}
      </CardBody>
    </Card>
  </Stack>
{/if}
