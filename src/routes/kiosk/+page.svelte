<script lang="ts">
  import { Spinner } from '$lib/components/ui/spinner';
  import { getKioskStatus } from '$lib/remotes/endpoints/kiosk.remote';
  import TabletIcon from '@lucide/svelte/icons/tablet';
  import { onDestroy } from 'svelte';
  import { KIOSK_SCREEN, KioskManager } from './kiosk-manager.svelte';
  import KioskPassEmail from './KioskPassEmail.svelte';
  import KioskPassEmailSent from './KioskPassEmailSent.svelte';
  import KioskResult from './KioskResult.svelte';
  import KioskScanner from './KioskScanner.svelte';
  import KioskWaiver from './KioskWaiver.svelte';

  const status = getKioskStatus();
  const kiosk = new KioskManager();

  const unpaired = $derived(
    status.current?.paired === false || kiosk.screen === KIOSK_SCREEN.UNPAIRED,
  );

  onDestroy(() => kiosk.destroy());
</script>

{#if status.loading}
  <div class="flex h-full items-center justify-center">
    <Spinner class="size-16" />
  </div>
{:else if unpaired}
  <div class="flex h-full flex-col items-center justify-center gap-6 p-12 text-center">
    <TabletIcon class="size-24 text-muted-foreground" />
    <h1 class="text-5xl font-semibold">This kiosk is not paired</h1>
    <p class="max-w-2xl text-2xl text-muted-foreground">
      Staff: open Settings → Check-in Kiosk and scan the pairing code with this iPad.
    </p>
  </div>
{:else if kiosk.screen === KIOSK_SCREEN.WAIVER && kiosk.waiver}
  <KioskWaiver
    {kiosk}
    passToken={kiosk.waiver.passToken}
    name={kiosk.waiver.name}
    email={kiosk.waiver.email}
  />
{:else if kiosk.screen === KIOSK_SCREEN.PASS_EMAIL && kiosk.passEmailRequestId}
  <KioskPassEmail {kiosk} requestId={kiosk.passEmailRequestId} />
{:else if kiosk.screen === KIOSK_SCREEN.PASS_EMAIL_SENT}
  <KioskPassEmailSent onDismiss={() => kiosk.reset()} />
{:else}
  <KioskScanner
    checking={kiosk.screen === KIOSK_SCREEN.CHECKING}
    onScan={(value) => kiosk.scan(value)}
    onRequestPassEmail={() => kiosk.requestPassEmail()}
  />
  {#if kiosk.screen === KIOSK_SCREEN.RESULT && kiosk.result}
    <div class="absolute inset-0">
      <KioskResult result={kiosk.result} onDismiss={() => kiosk.reset()} />
    </div>
  {/if}
{/if}
