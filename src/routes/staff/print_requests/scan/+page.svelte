<script lang="ts">
  import { updateAMSForPrinter } from '$lib/remotes/endpoints/print_materials.remote';
  import { Button } from '$lib/components/ui/button';
  import { Spinner } from '$lib/components/ui/spinner';
  import PageHeader from '$lib/frontend/components/PageHeader.svelte';
  import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
  import CircleXIcon from '@lucide/svelte/icons/circle-x';
  import FlashlightIcon from '@lucide/svelte/icons/flashlight';
  import FlashlightOffIcon from '@lucide/svelte/icons/flashlight-off';
  import { BarqodeStream, type DetectedBarcode } from 'barqode';
  import { onDestroy } from 'svelte';
  import { toast } from 'svelte-sonner';

  // The five labels sit far enough from the camera that each QR lands on ~60px of sensor at
  // 1080p. Below that the decoder stops resolving modules and the scan looks "flaky". Ask for
  // as much resolution as the camera will give, and pin the object so barqode doesn't read it
  // as a settings change and restart the stream on every render.
  const CAMERA_CONSTRAINTS: MediaTrackConstraints = {
    facingMode: 'environment',
    width: { ideal: 2560 },
    height: { ideal: 1440 },
    // focusMode is widely supported on phones but missing from the DOM typings
    advanced: [{ focusMode: 'continuous' }] as unknown as MediaTrackConstraintSet[],
  };

  const AMS_SLOT_COUNT = 4;

  // TTL configuration
  const CODE_TTL_MS = 1500; // Code expires after this long without being seen
  const CLEANUP_INTERVAL_MS = 100;
  const POSITION_THRESHOLD = 50; // Pixels - how close two codes must be to be considered the same instance

  interface TrackedCode {
    id: string;
    code: DetectedBarcode;
    lastSeen: number;
  }

  let loadingCamera = $state(true);
  let updatingAMS = $state(false);
  let torchOn = $state(false);
  let torchSupported = $state(false);
  let trackedCodes: TrackedCode[] = $state([]);
  let nextId = 0;

  // Derived states based on currently active codes
  let activeCodes = $derived(trackedCodes.map((tracked) => tracked.code));
  let foundPrinter = $derived(activeCodes.find((c) => c.rawValue.startsWith('SF-')));
  let hasAllFilaments = $derived.by(() => filaments.length === AMS_SLOT_COUNT);
  let filaments = $derived(
    activeCodes.filter((c) => !c.rawValue.startsWith('SF-') && c.rawValue.length == 8),
  );

  // Calculate center point of a code's bounding box
  function getCenter(code: DetectedBarcode): { x: number; y: number } {
    return {
      x: code.boundingBox.left + code.boundingBox.width / 2,
      y: code.boundingBox.top + code.boundingBox.height / 2,
    };
  }

  // Calculate distance between two points
  function distance(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
  }

  // Periodic cleanup of expired codes
  const cleanupInterval = setInterval(() => {
    if (updatingAMS) return;

    const now = Date.now();
    trackedCodes = trackedCodes.filter((tracked) => now - tracked.lastSeen <= CODE_TTL_MS);
  }, CLEANUP_INTERVAL_MS);

  onDestroy(() => {
    clearInterval(cleanupInterval);
  });

  function onCameraOn(capabilities: MediaTrackCapabilities) {
    loadingCamera = false;
    torchSupported = 'torch' in capabilities;
  }

  function track(detectedCodes: DetectedBarcode[], ctx: CanvasRenderingContext2D) {
    if (updatingAMS) return;
    const now = Date.now();
    const updatedCodes = [...trackedCodes];
    const matchedIndices = new Set<number>(); // Track which existing codes we've already matched

    for (const detectedCode of detectedCodes) {
      const [firstPoint, ...otherPoints] = detectedCode.cornerPoints;
      const detectedCenter = getCenter(detectedCode);

      // Try to find existing tracked instance (only from ORIGINAL trackedCodes, not newly added ones)
      const existingIndex = trackedCodes.findIndex((tracked, idx) => {
        // Skip if we've already matched this tracked code in this frame
        if (matchedIndices.has(idx)) return false;

        // Must have same raw value
        if (tracked.code.rawValue !== detectedCode.rawValue) return false;

        // Must be close in position (handles flicker from previous frames)
        const trackedCenter = getCenter(tracked.code);
        return distance(detectedCenter, trackedCenter) < POSITION_THRESHOLD;
      });

      if (existingIndex !== -1) {
        // Update existing instance immutably
        updatedCodes[existingIndex] = {
          ...updatedCodes[existingIndex],
          code: detectedCode,
          lastSeen: now,
        };
        matchedIndices.add(existingIndex);
      } else {
        // Add new instance
        updatedCodes.push({
          id: `code-${nextId++}`,
          code: detectedCode,
          lastSeen: now,
        });
      }

      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(firstPoint.x, firstPoint.y);

      for (const { x, y } of otherPoints) {
        ctx.lineTo(x, y);
      }

      ctx.lineTo(firstPoint.x, firstPoint.y);
      ctx.closePath();
      ctx.stroke();
    }

    // Update state immutably
    trackedCodes = updatedCodes;
  }

  async function updateAMS() {
    if (!foundPrinter) return;
    updatingAMS = true;

    try {
      const sortedFilaments = trackedCodes
        .map((tracked) => tracked.code)
        .filter((code) => !code.rawValue.startsWith('SF-'))
        .sort((a, b) => a.boundingBox.left - b.boundingBox.left)
        .map((code) => code.rawValue);

      await updateAMSForPrinter({
        printer_id: foundPrinter.rawValue,
        filaments: sortedFilaments,
      });

      toast.success('AMS updated successfully');
    } catch {
      toast.error('Failed to update AMS');
    } finally {
      updatingAMS = false;
    }
  }
</script>

<PageHeader title="Scan AMS" />

<!-- Sized to the viewport so the video never pushes the controls off screen. -->
<div
  class="mx-auto -mt-2 flex h-[calc(100dvh-8.5rem)] w-full max-w-2xl flex-col gap-3 sm:h-[calc(100dvh-9rem)] md:h-[calc(100dvh-6rem)] lg:h-[calc(100dvh-7rem)]"
>
  <div class="relative min-h-0 flex-1 overflow-hidden rounded-lg border bg-black">
    <BarqodeStream
      {onCameraOn}
      {track}
      constraints={CAMERA_CONSTRAINTS}
      torch={torchOn}
      paused={updatingAMS}
    >
      {#if loadingCamera}
        <div class="flex h-full items-center justify-center text-white">
          <Spinner class="size-6" />
        </div>
      {/if}
    </BarqodeStream>

    {#if !loadingCamera}
      <div
        class="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap gap-1.5 bg-gradient-to-b from-black/70 to-transparent p-2 pb-6 text-xs font-medium text-white"
      >
        <span class="flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1">
          {#if foundPrinter}
            <CircleCheckIcon class="size-3.5 text-success" />
            Printer {foundPrinter.rawValue.split('-')[1]}
          {:else}
            <CircleXIcon class="size-3.5 text-destructive" />
            No printer
          {/if}
        </span>
        <span class="flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1">
          {#if hasAllFilaments}
            <CircleCheckIcon class="size-3.5 text-success" />
          {:else}
            <CircleXIcon class="size-3.5 text-destructive" />
          {/if}
          {filaments.length}/{AMS_SLOT_COUNT} filaments
        </span>
      </div>
    {/if}
  </div>

  <div class="flex shrink-0 gap-2 pb-[env(safe-area-inset-bottom)]">
    {#if torchSupported}
      <Button
        variant="outline"
        size="icon-lg"
        aria-label={torchOn ? 'Turn light off' : 'Turn light on'}
        aria-pressed={torchOn}
        onclick={() => (torchOn = !torchOn)}
      >
        {#if torchOn}<FlashlightIcon />{:else}<FlashlightOffIcon />{/if}
      </Button>
    {/if}

    <Button
      size="lg"
      class="flex-1"
      disabled={!hasAllFilaments || !foundPrinter || updatingAMS}
      onclick={updateAMS}
    >
      {#if updatingAMS}<Spinner />{/if}
      Update AMS
    </Button>
  </div>
</div>
