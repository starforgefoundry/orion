<script lang="ts">
  import { kioskPairPathFromScan } from '$lib/utils/kiosk_pairing';
  import TabletIcon from '@lucide/svelte/icons/tablet';
  import KioskCameraView from './KioskCameraView.svelte';

  let pairing = $state(false);
  let invalidScan = $state(false);

  function onScan(value: string) {
    if (pairing) return;
    const path = kioskPairPathFromScan(value, window.location.origin);
    if (!path) {
      invalidScan = true;
      return;
    }

    pairing = true;
    // A full page load so the pairing cookie lands in this browser's cookie jar.
    window.location.assign(path);
  }
</script>

<div
  class="grid h-full grid-cols-1 grid-rows-[1fr_auto] gap-8 p-8 landscape:grid-cols-[3fr_2fr] landscape:grid-rows-1"
>
  <KioskCameraView busy={pairing} {onScan} />

  <div class="flex flex-col items-center justify-center gap-6 text-center">
    <TabletIcon class="size-24 text-muted-foreground" />
    <h1 class="text-5xl font-semibold">This kiosk is not paired</h1>
    <p class="text-2xl text-muted-foreground">
      Staff: open Settings → Check-in Kiosk and hold the pairing code up to the camera.
    </p>
    {#if invalidScan}
      <p class="text-2xl text-destructive">That code isn't a kiosk pairing link.</p>
    {/if}
  </div>
</div>
