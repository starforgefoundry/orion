<script lang="ts">
  import favicon from '$lib/assets/logo.png';
  import { toastManager, TooltipProvider } from '@immich/ui';
  import { onMount } from 'svelte';
  import '../app.css';

  let { children } = $props();

  onMount(() => {
    // open modals set pointer-events: none on body, which would make toasts unclickable
    toastManager.setOptions({ class: 'fixed pointer-events-auto' });
  });
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<TooltipProvider>
  {@render children()}
</TooltipProvider>
