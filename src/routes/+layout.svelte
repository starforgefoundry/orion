<script lang="ts">
  import { Toaster } from '$lib/components/ui/sonner';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import favicon from '$lib/assets/logo.png';
  import ModalHost from '$lib/frontend/components/ModalHost.svelte';
  import { ModeWatcher } from 'mode-watcher';
  import '../app.css';

  const TOOLTIP_DELAY_MS = 400;

  let { children } = $props();
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<ModeWatcher defaultMode="dark" />
<Toaster richColors position="top-center" />

<Tooltip.Provider
  delayDuration={TOOLTIP_DELAY_MS}
  skipDelayDuration={0}
  disableHoverableContent
  ignoreNonKeyboardFocus
>
  {@render children()}
  <ModalHost />
</Tooltip.Provider>
