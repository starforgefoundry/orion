<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Spinner } from '$lib/components/ui/spinner';
  import { submitWithToast } from '$lib/frontend/form-submit';
  import { modalManager } from '$lib/frontend/modal-manager.svelte';
  import { getKioskPairing, rotateKioskToken } from '$lib/remotes/endpoints/kiosk.remote';
  import QRCode from '@castlenine/svelte-qrcode';
  import CopyIcon from '@lucide/svelte/icons/copy';
  import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
  import { toast } from 'svelte-sonner';

  const QR_SIZE_PX = 220;

  const pairing = getKioskPairing();
  let rotating = $state(false);

  const pairingUrl = $derived(
    pairing.current?.pairingPath ? `${window.location.origin}${pairing.current.pairingPath}` : null,
  );

  async function rotate() {
    if (pairingUrl) {
      const confirmed = await modalManager.confirm({
        title: 'Replace pairing link?',
        prompt: 'Every kiosk paired with the current link will stop working until it is re-paired.',
        confirmText: 'Replace',
        variant: 'destructive',
      });
      if (!confirmed) return;
    }

    rotating = true;
    await submitWithToast(() => rotateKioskToken(), {
      success: 'New pairing link generated',
      error: 'Could not generate pairing link',
    });
    rotating = false;
  }

  async function copyLink() {
    if (!pairingUrl) return;
    await navigator.clipboard.writeText(pairingUrl);
    toast.success('Pairing link copied');
  }
</script>

{#if pairing.loading}
  <Spinner />
{:else if pairing.error}
  <p class="text-sm text-destructive">Error loading kiosk settings.</p>
{:else}
  <div class="flex flex-col gap-5">
    <p class="text-sm text-muted-foreground">
      Hold this code up to the kiosk's pairing screen. The iPad stays paired until a new link is
      generated.
    </p>

    {#if pairingUrl}
      <div class="flex flex-col items-start gap-4 sm:flex-row">
        <div class="shrink-0 rounded-lg bg-white p-3">
          <QRCode data={pairingUrl} size={QR_SIZE_PX} />
        </div>
        <div class="flex min-w-0 flex-1 flex-col gap-2">
          <code class="rounded-md border bg-muted/40 px-3 py-2 text-xs break-all">{pairingUrl}</code
          >
          <Button variant="outline" size="sm" class="self-start" onclick={copyLink}>
            <CopyIcon />
            Copy link
          </Button>
        </div>
      </div>
    {:else}
      <p class="text-sm">No kiosk has been paired yet.</p>
    {/if}

    <Button
      variant={pairingUrl ? 'outline' : 'default'}
      class="self-start"
      disabled={rotating}
      onclick={rotate}
    >
      {#if rotating}<Spinner />{:else}<RefreshCwIcon />{/if}
      {pairingUrl ? 'Replace pairing link' : 'Generate pairing link'}
    </Button>
  </div>
{/if}
