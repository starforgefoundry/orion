<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Spinner } from '$lib/components/ui/spinner';
  import PageHeader from '$lib/frontend/components/PageHeader.svelte';
  import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
  import CircleXIcon from '@lucide/svelte/icons/circle-x';
  import FlashlightIcon from '@lucide/svelte/icons/flashlight';
  import FlashlightOffIcon from '@lucide/svelte/icons/flashlight-off';
  import { BarqodeStream } from 'barqode';
  import { onMount } from 'svelte';
  import { AMS_SLOT_COUNT, AmsScanner, CAMERA_CONSTRAINTS } from './ams-scanner.svelte';

  const scanner = new AmsScanner();

  onMount(() => scanner.start());
</script>

<PageHeader title="Scan AMS" />

<!-- Sized to the viewport so the video never pushes the controls off screen. -->
<div
  class="mx-auto -mt-2 flex h-[calc(100dvh-8.5rem)] w-full max-w-2xl flex-col gap-3 sm:h-[calc(100dvh-9rem)] md:h-[calc(100dvh-6rem)] lg:h-[calc(100dvh-7rem)]"
>
  <div class="relative min-h-0 flex-1 overflow-hidden rounded-lg border bg-black">
    <BarqodeStream
      onCameraOn={(capabilities) => scanner.cameraOn(capabilities)}
      track={(codes, ctx) => scanner.track(codes, ctx)}
      constraints={CAMERA_CONSTRAINTS}
      torch={scanner.torchOn}
      paused={scanner.updating}
    >
      {#if scanner.loadingCamera}
        <div class="flex h-full items-center justify-center text-white">
          <Spinner class="size-6" />
        </div>
      {/if}
    </BarqodeStream>

    {#if !scanner.loadingCamera}
      <div
        class="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap gap-1.5 bg-gradient-to-b from-black/70 to-transparent p-2 pb-6 text-xs font-medium text-white"
      >
        <span class="flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1">
          {#if scanner.printer}
            <CircleCheckIcon class="size-3.5 text-success" />
            Printer {scanner.printerName}
          {:else}
            <CircleXIcon class="size-3.5 text-destructive" />
            No printer
          {/if}
        </span>
        <span class="flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1">
          {#if scanner.hasAllFilaments}
            <CircleCheckIcon class="size-3.5 text-success" />
          {:else}
            <CircleXIcon class="size-3.5 text-destructive" />
          {/if}
          {scanner.filaments.length}/{AMS_SLOT_COUNT} filaments
        </span>
      </div>
    {/if}
  </div>

  <div class="flex shrink-0 gap-2 pb-[env(safe-area-inset-bottom)]">
    {#if scanner.torchSupported}
      <Button
        variant="outline"
        size="icon-lg"
        aria-label={scanner.torchOn ? 'Turn light off' : 'Turn light on'}
        aria-pressed={scanner.torchOn}
        onclick={() => scanner.toggleTorch()}
      >
        {#if scanner.torchOn}<FlashlightIcon />{:else}<FlashlightOffIcon />{/if}
      </Button>
    {/if}

    <Button
      size="lg"
      class="flex-1"
      disabled={!scanner.canUpdate}
      onclick={() => scanner.updateAms()}
    >
      {#if scanner.updating}<Spinner />{/if}
      Update AMS
    </Button>
  </div>
</div>
