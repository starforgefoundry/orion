<script lang="ts">
  import { Spinner } from '$lib/components/ui/spinner';
  import logo from '$lib/assets/logo.png';
  import CameraOffIcon from '@lucide/svelte/icons/camera-off';
  import QrCodeIcon from '@lucide/svelte/icons/qr-code';
  import { BarqodeStream, type DetectedBarcode } from 'barqode';

  interface Props {
    checking: boolean;
    onScan: (value: string) => void;
  }

  let { checking, onScan }: Props = $props();

  // Phone screens blow out at normal exposure and the QR code washes away.
  const EXPOSURE_COMPENSATION_EV = -2;

  // Kept as a constant so barqode doesn't restart the stream on every render.
  const CAMERA_CONSTRAINTS: MediaTrackConstraints = {
    facingMode: 'user',
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    // exposureCompensation is missing from the DOM typings
    advanced: [
      { exposureMode: 'continuous', exposureCompensation: EXPOSURE_COMPENSATION_EV },
    ] as unknown as MediaTrackConstraintSet[],
  };

  let loadingCamera = $state(true);
  let cameraError = $state(false);

  // `track` fires on every frame; barqode's onDetect ignores a pass it saw last, even hours later.
  function track(codes: DetectedBarcode[]) {
    const [code] = codes;
    if (code) onScan(code.rawValue);
  }
</script>

<div class="grid h-full grid-cols-1 gap-8 p-8 landscape:grid-cols-[3fr_2fr]">
  <div class="relative min-h-0 overflow-hidden rounded-3xl border-4 bg-black">
    <!-- Mirrored so the front camera behaves like a mirror. -->
    <div class="h-full -scale-x-100">
      <BarqodeStream
        constraints={CAMERA_CONSTRAINTS}
        {track}
        onCameraOn={() => (loadingCamera = false)}
        onError={() => (cameraError = true)}
      />
    </div>

    {#if cameraError}
      <div class="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white">
        <CameraOffIcon class="size-16" />
        <p class="text-2xl">Camera unavailable — please see staff</p>
      </div>
    {:else if loadingCamera || checking}
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
  </div>
</div>
