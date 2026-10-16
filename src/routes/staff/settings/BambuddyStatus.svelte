<script lang="ts">
  import { Spinner } from '$lib/components/ui/spinner';
  import { getBambuddyStatus } from '$lib/remotes/endpoints/settings.remote';
  import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
  import CircleCheckIcon from '@lucide/svelte/icons/circle-check';

  const status = getBambuddyStatus();
</script>

<div class="flex items-center gap-2 rounded-md bg-muted/50 p-3 text-sm">
  {#if status.loading}
    <Spinner />
    <span class="text-muted-foreground">Checking Bambuddy connection…</span>
  {:else if status.error || !status.current}
    <CircleAlertIcon class="size-5 shrink-0 text-destructive" />
    <span class="text-destructive">Could not check the Bambuddy connection.</span>
  {:else if status.current.connected}
    <CircleCheckIcon class="size-5 shrink-0 text-success" />
    <div class="min-w-0">
      <p class="font-medium">Bambuddy connected</p>
      <p class="text-xs text-muted-foreground">
        Signed in as {status.current.username} · {status.current.printerCount} printers
      </p>
    </div>
  {:else}
    <CircleAlertIcon class="size-5 shrink-0 text-warning" />
    <div class="min-w-0">
      <p class="font-medium">Bambuddy not connected</p>
      <p class="text-xs text-muted-foreground">{status.current.reason}</p>
    </div>
  {/if}
</div>
