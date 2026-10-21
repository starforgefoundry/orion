<script lang="ts">
  import { Spinner } from '$lib/components/ui/spinner';
  import { getKioskStatus } from '$lib/remotes/endpoints/kiosk.remote';
  import { onDestroy } from 'svelte';
  import { KIOSK_SCREEN, KioskManager } from './kiosk-manager.svelte';
  import KioskPairing from './KioskPairing.svelte';
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
  <KioskPairing />
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
    covered={kiosk.screen === KIOSK_SCREEN.RESULT}
    onScan={(value) => kiosk.scan(value)}
    onRequestPassEmail={() => kiosk.requestPassEmail()}
  />
  {#if kiosk.screen === KIOSK_SCREEN.RESULT && kiosk.result}
    <div class="absolute inset-0">
      <KioskResult result={kiosk.result} onDismiss={() => kiosk.reset()} />
    </div>
  {/if}
{/if}
