<script lang="ts">
  import { updateAMSForPrinter } from '$lib/remotes/endpoints/print_materials.remote';
  import { Button, HStack, Icon, LoadingSpinner, toastManager } from '@immich/ui';
  import { mdiCheckCircle, mdiCloseCircle, mdiFlashlight, mdiFlashlightOff } from '@mdi/js';
  import { BarqodeStream, type DetectedBarcode } from 'barqode';
  import { onDestroy } from 'svelte';

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
    updatingAMS = true;
    if (!foundPrinter) return;

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

      toastManager.success('AMS updated successfully');
    } catch (error) {
      toastManager.danger('Failed to update AMS');
    } finally {
      updatingAMS = false;
    }
  }
</script>

<div class="mx-auto flex max-w-2xl flex-col items-center justify-center p-4">
  <BarqodeStream
    {onCameraOn}
    {track}
    constraints={CAMERA_CONSTRAINTS}
    torch={torchOn}
    paused={updatingAMS}
  >
    {#if loadingCamera}
      <div class="flex items-center justify-center">
        <LoadingSpinner />
      </div>
    {/if}
  </BarqodeStream>

  {#if !loadingCamera}
    <HStack class="mt-4">
      {#if foundPrinter}
        <Icon icon={mdiCheckCircle} class="text-success" />
        Printer Found: {foundPrinter.rawValue.split('-')[1]}
      {:else}
        <Icon icon={mdiCloseCircle} class="text-danger" />
        No Printer Found
      {/if}
    </HStack>
    <HStack>
      {#if filaments.length == 4}
        <Icon icon={mdiCheckCircle} class="text-success" />
      {:else}
        <Icon icon={mdiCloseCircle} class="text-danger" />
      {/if}
      {filaments.length}/4 Filaments Found
    </HStack>

    <HStack class="mt-2">
      {#if torchSupported}
        <Button
          variant="outline"
          color="secondary"
          onclick={() => (torchOn = !torchOn)}
          leadingIcon={torchOn ? mdiFlashlight : mdiFlashlightOff}
        >
          {torchOn ? 'Light On' : 'Light Off'}
        </Button>
      {/if}

      <Button
        disabled={filaments.length != 4 || !foundPrinter}
        loading={updatingAMS}
        onclick={updateAMS}
      >
        Update AMS
      </Button>
    </HStack>
  {/if}

  <!-- Debug info -->
  <!-- <div class="mt-4 w-full rounded border p-2 text-xs">
    <div class="font-semibold">Tracked Codes ({trackedCodes.length}):</div>
    {#each trackedCodes as tracked}
      <div class="mt-1">
        {tracked.id}: {tracked.code.rawValue} @ ({Math.round(getCenter(tracked.code).x)}, {Math.round(
          getCenter(tracked.code).y,
        )})
      </div>
    {/each}
  </div> -->
</div>
