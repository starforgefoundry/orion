<script lang="ts">
  import {
    getPrintRequestSettings,
    getPrintRequestSquareSettings,
  } from '$lib/remotes/endpoints/settings.remote';
  import { Heading, LoadingSpinner } from '@immich/ui';
  import SquareSettings from './SquareSettings.svelte';
  import SystemSettings from './SystemSettings.svelte';

  // Fetch initial settings
  let printRequestSettings = getPrintRequestSettings();
  let squareSettings = getPrintRequestSquareSettings();
</script>

<div class="mb-6">
  <Heading size="large">Settings</Heading>
</div>

<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
  {#if printRequestSettings.loading}
    <LoadingSpinner />
  {:else if printRequestSettings.error}
    <p class="text-danger">Error loading print request settings.</p>
  {:else}
    <SystemSettings printRequestSettings={printRequestSettings.current!} />
  {/if}

  {#if squareSettings.loading}
    <LoadingSpinner />
  {:else if squareSettings.error}
    <p class="text-danger">Error loading Square settings.</p>
  {:else}
    <SquareSettings squareSettings={squareSettings.current!} />
  {/if}
</div>
