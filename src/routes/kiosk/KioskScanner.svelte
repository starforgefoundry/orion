<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Spinner } from '$lib/components/ui/spinner';
  import logo from '$lib/assets/logo.png';
  import CameraOffIcon from '@lucide/svelte/icons/camera-off';
  import MailIcon from '@lucide/svelte/icons/mail';
  import QrCodeIcon from '@lucide/svelte/icons/qr-code';
  import { BarqodeStream, type DetectedBarcode } from 'barqode';
  import { onDestroy } from 'svelte';
  import { KioskCamera } from './kiosk-camera.svelte';

  interface Props {
    checking: boolean;
    onScan: (value: string) => void;
    onRequestPassEmail: () => void;
  }

  let { checking, onScan, onRequestPassEmail }: Props = $props();

  // Kept as a constant so barqode doesn't restart the stream on every render.
  const CAMERA_CONSTRAINTS: MediaTrackConstraints = {
    facingMode: 'user',
    width: { ideal: 1920 },
    height: { ideal: 1080 },
  };

  const camera = new KioskCamera();

  // `track` fires on every frame; barqode's onDetect ignores a pass it saw last, even hours later.
  function track(codes: DetectedBarcode[]) {
    const [code] = codes;
    if (code) onScan(code.rawValue);
  }

  onDestroy(() => camera.destroy());
</script>

<svelte:document onvisibilitychange={() => camera.visibilityChanged()} />

<div class="grid h-full grid-cols-1 gap-8 p-8 landscape:grid-cols-[3fr_2fr]">
  <div class="relative min-h-0 overflow-hidden rounded-3xl border-4 bg-black">
    <!-- Mirrored so the front camera behaves like a mirror. -->
    <div class="h-full -scale-x-100">
      {#key camera.streamId}
        <BarqodeStream
          constraints={CAMERA_CONSTRAINTS}
          {track}
          bind:videoRef={camera.video}
          onCameraOn={() => camera.started()}
          onError={() => camera.failed()}
        />
      {/key}
    </div>

    {#if camera.error}
      <div class="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white">
        <CameraOffIcon class="size-16" />
        <p class="text-2xl">Camera unavailable — please see staff</p>
      </div>
    {:else if camera.loading || checking}
      <div class="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
        <Spinner class="size-16" />
      </div>
    {/if}
  </div>

  <div class="flex flex-col items-center justify-center gap-8 text-center">
    <img src={logo} alt="Starforge" class="size-28" />
    <div class="flex flex-col gap-3">
      <h1 class="text-5xl font-semibold">Welcome to Starforge</h1>
      <p class="text-2xl text-muted-foreground">Hold your member pass QR code up to the camera.</p>
    </div>
    <QrCodeIcon class="size-24 text-muted-foreground" />
    <Button variant="outline" class="h-16 px-8 text-xl" onclick={onRequestPassEmail}>
      <MailIcon class="size-6" />
      Don't have your pass? Email it to me
    </Button>
  </div>
</div>
