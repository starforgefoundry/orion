<script lang="ts">
  import favicon from '$lib/assets/logo.png';
  import { initializeTheme, TooltipProvider } from '@immich/ui';
  import '../app.css';

  let { children } = $props();
  initializeTheme();
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<TooltipProvider>
  {@render children()}
</TooltipProvider>
