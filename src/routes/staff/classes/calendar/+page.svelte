<script lang="ts">
  import CalendarGrid from '$lib/frontend/components/CalendarGrid.svelte';
  import { formatTime, parseTime } from '$lib/frontend/utils';
  import { getAllInstances } from '$lib/remotes/endpoints/class.remote';
  import {
    Button,
    Card,
    CardBody,
    Heading,
    HStack,
    IconButton,
    LoadingSpinner,
    modalManager,
    Stack,
  } from '@immich/ui';
  import { mdiCalendarSync, mdiPlus } from '@mdi/js';
  import CalendarSubscribeModal from './CalendarSubscribeModal.svelte';
  import InstanceDetailModal from './InstanceDetailModal.svelte';
  import ScheduleClassModal from './ScheduleClassModal.svelte';

  const instancesRemote = getAllInstances();
  const instances = $derived(instancesRemote.current ?? []);

  function openCreateInstance() {
    modalManager.show(ScheduleClassModal, {});
  }

  function openInstanceDetail(instanceId: string) {
    modalManager.show(InstanceDetailModal, { instanceId });
  }
</script>

<svelte:head>
  <title>Classes</title>
</svelte:head>

<svelte:window onfocus={() => getAllInstances().refresh()} />

<Stack gap={4}>
  <HStack class="items-center justify-between">
    <Heading>Classes</Heading>
    <HStack gap={2}>
      <IconButton
        icon={mdiCalendarSync}
        variant="outline"
        aria-label="Subscribe to calendar"
        onclick={() => modalManager.show(CalendarSubscribeModal, {})}
      />

      <Button leadingIcon={mdiPlus} onclick={openCreateInstance}>Schedule Class</Button>
    </HStack>
  </HStack>

  {#if instancesRemote.loading}
    <LoadingSpinner class="mx-auto" size="large" />
  {:else}
    <Card>
      <CardBody>
        <CalendarGrid {instances} filter={(inst) => inst.status === 'scheduled'}>
          {#snippet dayContent({ instances: dayInstances })}
            {@const sortedDayInstances = dayInstances.sort(
              (a, b) => parseTime(a.startTime).getTime() - parseTime(b.startTime).getTime(),
            )}
            <div class="flex flex-col gap-2">
              {#each sortedDayInstances as inst}
                <button
                  class=" w-full cursor-pointer rounded bg-gray-700/50 p-1 px-2 text-left text-xs hover:bg-gray-600/50"
                  onclick={() => openInstanceDetail(inst.id)}
                >
                  <div class="mb-1 flex justify-between">
                    <span class="font-medium">{formatTime(inst.startTime)}</span>
                    <span class="text-gray-500">
                      {inst.confirmedCount ?? 0}/{inst.seats}
                    </span>
                  </div>
                  <span class=" text-gray-400">
                    {inst.catalog?.name}
                  </span>
                </button>
              {/each}
            </div>
          {/snippet}
        </CalendarGrid>
      </CardBody>
    </Card>
  {/if}
</Stack>
