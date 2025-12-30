<script lang="ts">
  import favicon from '$lib/assets/logo.png';
  import { initializeTheme, toastManager } from '@immich/ui';
  import { onMount } from 'svelte';
  import '../app.css';

  let { children } = $props();
  initializeTheme();

  onMount(() => {
    toastManager.setOptions({
      class: 'fixed top-0 right-0 flex flex-col items-end justify-end gap-2 p-4',
    });
  });
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
