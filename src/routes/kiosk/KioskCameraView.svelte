<script lang="ts">
  import { Spinner } from '$lib/components/ui/spinner';
  import CameraOffIcon from '@lucide/svelte/icons/camera-off';
  import { BarqodeStream, type DetectedBarcode } from 'barqode';
  import { onDestroy } from 'svelte';
  import { KioskCamera } from './kiosk-camera.svelte';
  import { hasNativeCamera, NativeKioskCamera } from './native-kiosk-camera.svelte';

  interface Props {
    busy?: boolean;
    /** Something is drawn over the camera, so the native camera must step aside. */
    covered?: boolean;
    onScan: (value: string) => void;
  }

  let { busy = false, covered = false, onScan }: Props = $props();

  // Kept as a constant so barqode doesn't restart the stream on every render.
  const CAMERA_CONSTRAINTS: MediaTrackConstraints = {
    facingMode: 'user',
    width: { ideal: 1920 },
    height: { ideal: 1080 },
  };

  const nativeCamera = hasNativeCamera() ? new NativeKioskCamera((value) => onScan(value)) : null;
  const webCamera = nativeCamera ? null : new KioskCamera();
  const camera = nativeCamera ?? webCamera!;

  $effect(() => nativeCamera?.setHidden(busy || covered));

  // `track` fires on every frame; barqode's onDetect ignores a code it saw last, even hours later.
  function track(codes: DetectedBarcode[]) {
    const [code] = codes;
    if (code) onScan(code.rawValue);
  }

  onDestroy(() => webCamera?.destroy());
</script>

<svelte:document onvisibilitychange={() => webCamera?.visibilityChanged()} />

<div class="relative min-h-0 overflow-hidden rounded-3xl border-4 bg-black">
  {#if nativeCamera}
    <div class="absolute inset-0" {@attach nativeCamera.attach}></div>
  {:else if webCamera}
    <!-- Mirrored so the front camera behaves like a mirror. -->
    <div class="h-full -scale-x-100">
      {#key webCamera.streamId}
        <BarqodeStream
          constraints={CAMERA_CONSTRAINTS}
          {track}
          bind:videoRef={webCamera.video}
          onCameraOn={() => webCamera.started()}
          onError={() => webCamera.failed()}
        />
      {/key}
    </div>
  {/if}

  {#if camera.error}
    <div class="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white">
      <CameraOffIcon class="size-16" />
      <p class="text-2xl">Camera unavailable — please see staff</p>
    </div>
  {:else if camera.loading || busy}
    <div class="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
      <Spinner class="size-16" />
    </div>
  {/if}
</div>
