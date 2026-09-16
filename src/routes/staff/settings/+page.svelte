<script lang="ts">
  import {
    getClassSettings,
    getPrintRequestSettings,
    getPrintRequestSquareSettings,
  } from '$lib/remotes/endpoints/settings.remote';
  import { Button, Heading, LoadingSpinner, modalManager } from '@immich/ui';
  import BambuLoginModal from './BambuLoginModal.svelte';
  import ClassSettings from './ClassSettings.svelte';
  import LocalPrinterModal from './LocalPrinterModal.svelte';
  import LocalPrinterSettings from './LocalPrinterSettings.svelte';
  import SettingsSection from './SettingsSection.svelte';
  import SquareSettings from './SquareSettings.svelte';
  import SystemSettings from './SystemSettings.svelte';

  let printRequestSettings = getPrintRequestSettings();
  let squareSettings = getPrintRequestSquareSettings();
  let classSettings = getClassSettings();
</script>

<div class="mb-6">
  <Heading size="large">Settings</Heading>
</div>

<div class="flex flex-col items-center gap-4">
  <SettingsSection title="3D Print Requests">
    {#snippet headerActions()}
      <div class="flex items-center gap-2">
        <Button variant="outline" size="small" onclick={() => modalManager.show(BambuLoginModal)}>
          Refresh Bambu Token
        </Button>
        <Button type="submit" form="print-request-settings" size="small">Save</Button>
      </div>
    {/snippet}
    {#if printRequestSettings.loading}
      <LoadingSpinner />
    {:else if printRequestSettings.error}
      <p class="text-danger">Error loading print request settings.</p>
    {:else}
      <SystemSettings printRequestSettings={printRequestSettings.current!} />
    {/if}
  </SettingsSection>

  <SettingsSection title="LAN Mode Printers">
    {#snippet headerActions()}
      <Button
        variant="filled"
        size="small"
        onclick={() => modalManager.show(LocalPrinterModal, {})}
      >
        Add Printer
      </Button>
    {/snippet}
    <LocalPrinterSettings />
  </SettingsSection>

  <SettingsSection title="Square">
    {#snippet headerActions()}
      <Button type="submit" form="square-settings" size="small">Save</Button>
    {/snippet}
    {#if squareSettings.loading}
      <LoadingSpinner />
    {:else if squareSettings.error}
      <p class="text-danger">Error loading Square settings.</p>
    {:else}
      <SquareSettings squareSettings={squareSettings.current!} />
    {/if}
  </SettingsSection>

  <SettingsSection title="Classes">
    {#snippet headerActions()}
      <Button type="submit" form="class-settings" size="small">Save</Button>
    {/snippet}
    {#if classSettings.loading}
      <LoadingSpinner />
    {:else if classSettings.error}
      <p class="text-danger">Error loading class settings.</p>
    {:else}
      <ClassSettings classSettings={classSettings.current!} />
    {/if}
  </SettingsSection>
</div>
