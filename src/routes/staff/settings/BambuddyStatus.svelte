<script lang="ts">
  import { getBambuddyStatus } from '$lib/remotes/endpoints/settings.remote';
  import { Icon, LoadingSpinner, Text } from '@immich/ui';
  import { mdiAlertCircleOutline, mdiCheckCircleOutline } from '@mdi/js';

  const status = getBambuddyStatus();
</script>

<div class="bg-level-1 mt-4 flex items-center gap-2 rounded-xl p-4">
  {#if status.loading}
    <LoadingSpinner size="small" />
    <Text color="muted">Checking Bambuddy connection…</Text>
  {:else if status.error || !status.current}
    <Icon icon={mdiAlertCircleOutline} class="text-danger" size="1.5em" />
    <Text color="danger">Could not check the Bambuddy connection.</Text>
  {:else if status.current.connected}
    <Icon icon={mdiCheckCircleOutline} class="text-success" size="1.5em" />
    <div>
      <Text fontWeight="bold">Bambuddy connected</Text>
      <Text size="small" color="muted">
        Signed in as {status.current.username} · {status.current.printerCount} printers
      </Text>
    </div>
  {:else}
    <Icon icon={mdiAlertCircleOutline} class="text-warning" size="1.5em" />
    <div>
      <Text fontWeight="bold">Bambuddy not connected</Text>
      <Text size="small" color="muted">{status.current.reason}</Text>
    </div>
  {/if}
</div>
