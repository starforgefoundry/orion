<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Spinner } from '$lib/components/ui/spinner';
  import FormField from '$lib/frontend/components/form/FormField.svelte';
  import { initForm } from '$lib/frontend/components/form/utils.svelte';
  import { enhanceWithToast } from '$lib/frontend/form-submit';
  import {
    getMemberSquareSettings,
    memberSquareSettingsForm,
  } from '$lib/remotes/endpoints/settings.remote';
  import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
  import { MemberSquareSettingsManager } from './member-square-settings.svelte';

  interface Props {
    formId?: string;
  }

  const { formId = 'member-square-settings' }: Props = $props();

  const settings = getMemberSquareSettings();
  const manager = new MemberSquareSettingsManager();

  initForm(memberSquareSettingsForm, () => ({
    dayPassItemVariationIds: settings.current?.dayPassItemVariationIds ?? [],
  }));
</script>

<div class="flex flex-col gap-6">
  {#if settings.loading || manager.catalog.loading}
    <Spinner />
  {:else if settings.error}
    <p class="text-sm text-destructive">Error loading member settings: {settings.error.message}</p>
  {:else if manager.catalog.error}
    <p class="text-sm text-destructive">
      Error loading Square catalog: {manager.catalog.error.message}
    </p>
  {:else}
    <form
      id={formId}
      {...enhanceWithToast(memberSquareSettingsForm, {
        success: 'Settings saved',
        error: 'Error saving settings',
      })}
    >
      <FormField
        label="Day Pass Items"
        description="Purchases of these items by a customer with an email give them day passes"
      >
        <div class="flex max-h-64 flex-col gap-2 overflow-y-auto rounded-md border p-3">
          {#each manager.variationOptions as option (option.value)}
            <label class="flex items-center gap-2 text-sm">
              <input
                class="size-4 accent-primary"
                {...memberSquareSettingsForm.fields.dayPassItemVariationIds.as(
                  'checkbox',
                  option.value,
                )}
              />
              {option.label}
            </label>
          {:else}
            <p class="text-sm text-muted-foreground">No items in the Square catalog.</p>
          {/each}
        </div>
      </FormField>
    </form>
  {/if}

  <FormField
    label="Sync Members"
    description="Imports members from active Square subscriptions without emailing them"
  >
    <div class="flex flex-wrap items-center gap-3">
      <Button variant="outline" disabled={manager.isSyncing} onclick={() => manager.sync()}>
        {#if manager.isSyncing}
          <Spinner />
        {:else}
          <RefreshCwIcon />
        {/if}
        Sync members from Square
      </Button>
      {#if manager.lastSync}
        <p class="text-sm text-muted-foreground">
          {manager.lastSync.total} subscriptions: {manager.lastSync.created} new, {manager.lastSync
            .updated} updated, {manager.lastSync.skipped} skipped
        </p>
      {/if}
    </div>
  </FormField>
</div>
