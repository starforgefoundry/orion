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
  import { getSquareCatalog, getSquareLocations } from '$lib/remotes/endpoints/square.remote';

  interface Props {
    squareSettings: {
      locationId: string;
      memberPrintDiscountId: string;
      printRequestItemId: string;
      additionalBuildPlateItemId: string;
    };
    formId?: string;
  }

  let { squareSettings, formId = 'square-settings' }: Props = $props();

  initForm(printRequestSquareSettingsForm, () => ({
    locationId: squareSettings.locationId,
    memberPrintDiscountId: squareSettings.memberPrintDiscountId,
    printRequestItemId: squareSettings.printRequestItemId,
    additionalBuildPlateItemId: squareSettings.additionalBuildPlateItemId,
  }));

  let locationId = $derived(squareSettings.locationId);
  let memberPrintDiscountId = $derived(squareSettings.memberPrintDiscountId);
  let printRequestItemId = $derived(squareSettings.printRequestItemId);
  let additionalBuildPlateItemId = $derived(squareSettings.additionalBuildPlateItemId);

  let locationRequest = getSquareLocations();
  let squareLocations = $derived(locationRequest.current ?? []);
  let squareLocationOptions: SelectOption[] = $derived(
    squareLocations.map((loc) => ({
      label: loc.name ?? '',
      value: loc.id ?? '',
    })),
  );

  let catalogRequest = getSquareCatalog();
  let squareCatalog = $derived(catalogRequest.current ?? []);
  let squareItemOptions: SelectOption[] = $derived(
    squareCatalog
      .filter((item) => item.type === 'ITEM')
      .map((item) => ({
        label: item.itemData?.name || 'Unnamed Item',
        value: item.itemData?.variations?.[0]?.id || '',
      })),
  );
  let squareDiscountOptions: SelectOption[] = $derived(
    squareCatalog
      .filter((item) => item.type === 'DISCOUNT')
      .map((item) => ({
        label: item.discountData?.name || 'Unnamed Discount',
        value: item.id,
      })),
  );
</script>

{#if locationRequest.loading || catalogRequest.loading}
  <Spinner />
{:else if locationRequest.error}
  <p class="text-sm text-destructive">
    Error loading Square locations: {locationRequest.error.message}
  </p>
{:else if catalogRequest.error}
  <p class="text-sm text-destructive">
    Error loading Square catalog: {catalogRequest.error.message}
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
    <FormField label="Location" required>
      <OptionSelect
        options={squareLocationOptions}
        bind:value={locationId}
        placeholder="Square Location"
      />
      <HiddenField field={printRequestSquareSettingsForm.fields.locationId} value={locationId} />
    </FormField>

    <FormField label="Member Print Discount Item" required>
      <OptionSelect
        options={squareDiscountOptions}
        bind:value={memberPrintDiscountId}
        placeholder="Select Discount"
      />
      <HiddenField
        field={printRequestSquareSettingsForm.fields.memberPrintDiscountId}
        value={memberPrintDiscountId}
      />
    </FormField>

    <FormField label="Print Request Item" required>
      <OptionSelect
        options={squareItemOptions}
        bind:value={printRequestItemId}
        placeholder="Select Item"
      />
      <HiddenField
        field={printRequestSquareSettingsForm.fields.printRequestItemId}
        value={printRequestItemId}
      />
    </FormField>

    <FormField label="Additional Build Plate Item" required>
      <OptionSelect
        options={squareItemOptions}
        bind:value={additionalBuildPlateItemId}
        placeholder="Select Item"
      />
      <HiddenField
        field={printRequestSquareSettingsForm.fields.additionalBuildPlateItemId}
        value={additionalBuildPlateItemId}
      />
    </FormField>
  </form>
{/if}
