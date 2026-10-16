<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Spinner } from '$lib/components/ui/spinner';
  import CalendarGrid from '$lib/frontend/components/CalendarGrid.svelte';
  import IconButton from '$lib/frontend/components/IconButton.svelte';
  import PageHeader from '$lib/frontend/components/PageHeader.svelte';
  import { modalManager } from '$lib/frontend/modal-manager.svelte';
  import { formatTime, parseTime } from '$lib/frontend/utils';
  import { getAllInstances } from '$lib/remotes/endpoints/class.remote';
  import CalendarSyncIcon from '@lucide/svelte/icons/calendar-sync';
  import PlusIcon from '@lucide/svelte/icons/plus';
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

<svelte:window onfocus={() => getAllInstances().refresh()} />

<PageHeader title="Classes">
  {#snippet actions()}
    <IconButton
      icon={CalendarSyncIcon}
      variant="outline"
      size="icon"
      aria-label="Subscribe to calendar"
      onclick={() => modalManager.show(CalendarSubscribeModal, {})}
    />
    <Button onclick={openCreateInstance}>
      <PlusIcon />
      Schedule Class
    </Button>
  {/snippet}
</PageHeader>

{#if instancesRemote.loading && !instancesRemote.current}
  <div class="flex justify-center py-10">
    <Spinner class="size-6" />
  </div>
{:else}
  <CalendarGrid {instances} filter={(inst) => inst.status === 'scheduled'}>
    {#snippet dayContent({ instances: dayInstances })}
      {@const sortedDayInstances = dayInstances.sort(
        (a, b) => parseTime(a.startTime).getTime() - parseTime(b.startTime).getTime(),
      )}
      <div class="flex flex-col gap-1">
        {#each sortedDayInstances as inst (inst.id)}
          <button
            type="button"
            class="w-full cursor-pointer rounded-md bg-muted px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent md:px-1.5 md:py-1"
            onclick={() => openInstanceDetail(inst.id)}
          >
            <div class="flex justify-between gap-1">
              <span class="font-medium">{formatTime(inst.startTime)}</span>
              <span class="text-muted-foreground tabular-nums">
                {inst.confirmedCount ?? 0}/{inst.seats}
              </span>
            </div>
            <div class="truncate text-muted-foreground">{inst.catalog?.name}</div>
          </button>
        {/each}
      </div>
    {/snippet}
  </CalendarGrid>
{/if}
