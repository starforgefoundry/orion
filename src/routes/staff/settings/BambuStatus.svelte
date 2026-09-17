<script lang="ts">
  import { getBambuStatus } from '$lib/remotes/endpoints/settings.remote';
  import { Button, Icon, LoadingSpinner, Text, modalManager } from '@immich/ui';
  import { mdiAlertCircleOutline, mdiCheckCircleOutline } from '@mdi/js';
  import BambuLoginModal from './BambuLoginModal.svelte';

  const status = getBambuStatus();
</script>

<div class="bg-level-1 mt-4 flex items-center justify-between gap-4 rounded-xl p-4">
  <div class="flex items-center gap-2">
    {#if status.loading}
      <LoadingSpinner size="small" />
      <Text color="muted">Checking Bambu Lab connection…</Text>
    {:else if status.error || !status.current}
      <Icon icon={mdiAlertCircleOutline} class="text-danger" size="1.5em" />
      <Text color="danger">Could not check the Bambu Lab connection.</Text>
    {:else if status.current.connected}
      <Icon icon={mdiCheckCircleOutline} class="text-success" size="1.5em" />
      <div>
        <Text fontWeight="bold">Bambu Lab connected</Text>
        <Text size="small" color="muted">
          {status.current.name} ({status.current.account})
        </Text>
      </div>
    {:else}
      <Icon icon={mdiAlertCircleOutline} class="text-warning" size="1.5em" />
      <div>
        <Text fontWeight="bold">Bambu Lab not connected</Text>
        <Text size="small" color="muted">{status.current.reason}</Text>
      </div>
    {/if}
  </div>

  <Button
    variant="outline"
    size="small"
    onclick={() => modalManager.show(BambuLoginModal)}
    disabled={status.loading}
  >
    Sign In
  </Button>
</div>
