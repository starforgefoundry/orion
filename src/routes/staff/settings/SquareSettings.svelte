<script lang="ts">
  import { Spinner } from '$lib/components/ui/spinner';
  import FormField from '$lib/frontend/components/form/FormField.svelte';
  import HiddenField from '$lib/frontend/components/form/HiddenField.svelte';
  import OptionSelect, {
    type SelectOption,
  } from '$lib/frontend/components/form/OptionSelect.svelte';
  import { initForm } from '$lib/frontend/components/form/utils.svelte';
  import { enhanceWithToast } from '$lib/frontend/form-submit';
  import { printRequestSquareSettingsForm } from '$lib/remotes/endpoints/settings.remote';
  import { getSquareLocations } from '$lib/remotes/endpoints/square.remote';

  interface Props {
    squareSettings: {
      locationId: string;
    };
    formId?: string;
  }

  let { squareSettings, formId = 'square-settings' }: Props = $props();

  initForm(printRequestSquareSettingsForm, () => ({
    locationId: squareSettings.locationId,
  }));

  let locationId = $derived(squareSettings.locationId);

  let locationRequest = getSquareLocations();
  let squareLocationOptions: SelectOption[] = $derived(
    (locationRequest.current ?? []).map((loc) => ({
      label: loc.name ?? '',
      value: loc.id ?? '',
    })),
  );
</script>

{#if locationRequest.loading}
  <Spinner />
{:else if locationRequest.error}
  <p class="text-sm text-destructive">
    Error loading Square locations: {locationRequest.error.message}
  </p>
{:else}
  <form
    id={formId}
    class="flex flex-col gap-5"
    {...enhanceWithToast(printRequestSquareSettingsForm, {
      success: 'Settings saved',
      error: 'Error saving settings',
    })}
  >
    <FormField
      label="Location"
      required
      description="Card payments for prints, classes, the car bay and organizations are taken here."
    >
      <OptionSelect
        options={squareLocationOptions}
        bind:value={locationId}
        placeholder="Square Location"
      />
      <HiddenField field={printRequestSquareSettingsForm.fields.locationId} value={locationId} />
    </FormField>
  </form>
{/if}
