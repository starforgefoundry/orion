<script lang="ts">
  import { Spinner } from '$lib/components/ui/spinner';
  import Modal from '$lib/frontend/components/Modal.svelte';
  import { kioskPairPathFromScan } from '$lib/utils/kiosk_pairing';
  import CameraOffIcon from '@lucide/svelte/icons/camera-off';
  import QrCodeIcon from '@lucide/svelte/icons/qr-code';
  import { BarqodeStream, type DetectedBarcode } from 'barqode';

  interface Props {
    onClose: () => void;
  }

  let { onClose }: Props = $props();

  // Kept as a constant so barqode doesn't restart the stream on every render.
  const CAMERA_CONSTRAINTS: MediaTrackConstraints = { facingMode: 'environment' };

  let loadingCamera = $state(true);
  let cameraError = $state(false);
  let pairing = $state(false);
  let invalidScan = $state(false);

  function onDetect(codes: DetectedBarcode[]) {
    if (pairing) return;
    const path = codes
      .map((code) => kioskPairPathFromScan(code.rawValue, window.location.origin))
      .find((candidate) => candidate !== null);

    if (!path) {
      invalidScan = true;
      return;
    }

    pairing = true;
    // A full page load so the pairing cookie lands in this app's cookie jar.
    window.location.assign(path);
  }
</script>

<Modal title="Pair kiosk" icon={QrCodeIcon} {onClose}>
  <div class="flex flex-col gap-3">
    <div class="relative aspect-square overflow-hidden rounded-lg bg-black">
      <BarqodeStream
        constraints={CAMERA_CONSTRAINTS}
        {onDetect}
        onCameraOn={() => (loadingCamera = false)}
        onError={() => (cameraError = true)}
      />

      {#if cameraError}
        <div class="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white">
          <CameraOffIcon class="size-10" />
          <p class="text-sm">Camera unavailable</p>
        </div>
      {:else if loadingCamera || pairing}
        <div class="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
          <Spinner class="size-10" />
        </div>
      {/if}
    </div>

    {#if invalidScan}
      <p class="text-sm text-destructive">That code isn't a kiosk pairing link.</p>
    {:else}
      <p class="text-sm text-muted-foreground">
        Scan the pairing code from Settings → Check-in Kiosk.
      </p>
    {/if}
  </div>
</Modal>
