<script lang="ts">
  import { initForm } from '$lib/frontend/components/form/utils.svelte';
  import { printRequestSquareSettingsForm } from '$lib/remotes/endpoints/settings.remote';
  import { getSquareCatalog, getSquareLocations } from '$lib/remotes/endpoints/square.remote';
  import {
    Field,
    LoadingSpinner,
    modalManager,
    Select,
    Stack,
    toastManager,
    type SelectOption,
  } from '@immich/ui';
  import SquareInfoModal from './SquareInfoModal.svelte';

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

  function showSquareInfoModal() {
    modalManager.show(SquareInfoModal);
  }

  let locationRequest = getSquareLocations();
  let squareLocations = $derived(locationRequest.current ?? []);
  let squareLocationOptions = $derived(
    squareLocations.map((loc) => ({
      label: loc.name,
      value: loc.id,
    })) as SelectOption[],
  );

  let catalogRequest = getSquareCatalog();
  let squareCatalog = $derived(catalogRequest.current ?? []);
  let squareItemOptions = $derived(
    squareCatalog
      .filter((item) => item.type === 'ITEM')
      .map((item) => ({
        label: item.itemData?.name || 'Unnamed Item',
        value: item.itemData?.variations?.[0]?.id || '',
      })) as SelectOption[],
  );
  let squareDiscountOptions = $derived(
    squareCatalog
      .filter((item) => item.type === 'DISCOUNT')
      .map((item) => ({
        label: item.discountData?.name || 'Unnamed Discount',
        value: item.id,
      })) as SelectOption[],
  );

  async function handleSubmit(submit: () => Promise<void>) {
    try {
      await submit();
      toastManager.show({
        title: 'Settings Saved',
        description: 'Settings have been updated successfully.',
        color: 'success',
      });
    } catch (error) {
      toastManager.show({
        title: 'Error Saving Settings',
        description: 'An error occurred while saving settings. Please try again.',
        color: 'danger',
      });
    }
  }
</script>

{#if locationRequest.loading || catalogRequest.loading}
  <LoadingSpinner />
{:else if locationRequest.error}
  <div class="flex items-center justify-center">
    <p class="text-danger">Error loading Square locations: {locationRequest.error.message}</p>
  </div>
{:else if catalogRequest.error}
  <div class="flex items-center justify-center">
    <p class="text-danger">Error loading Square catalog: {catalogRequest.error.message}</p>
  </div>
{:else}
  <form
    id={formId}
    {...printRequestSquareSettingsForm.enhance(async ({ submit }) => await handleSubmit(submit))}
  >
    <Stack gap={4}>
      <Field label="Location" required="indicator">
        <Select
          value={printRequestSquareSettingsForm.fields.locationId.value()}
          options={squareLocationOptions}
          placeholder="Square Location"
          onChange={(value) => printRequestSquareSettingsForm.fields.locationId.set(value)}
        />
        <input hidden {...printRequestSquareSettingsForm.fields.locationId.as('text')} />
      </Field>

      <Field label="Member Print Discount Item" required="indicator">
        <Select
          value={printRequestSquareSettingsForm.fields.memberPrintDiscountId.value()}
          options={squareDiscountOptions}
          placeholder="Select Discount"
          onChange={(value) =>
            printRequestSquareSettingsForm.fields.memberPrintDiscountId.set(value)}
        />
        <input hidden {...printRequestSquareSettingsForm.fields.memberPrintDiscountId.as('text')} />
      </Field>

      <Field label="Print Request Item" required="indicator">
        <Select
          value={printRequestSquareSettingsForm.fields.printRequestItemId.value()}
          options={squareItemOptions}
          placeholder="Select Item"
          onChange={(value) => printRequestSquareSettingsForm.fields.printRequestItemId.set(value)}
        />
        <input hidden {...printRequestSquareSettingsForm.fields.printRequestItemId.as('text')} />
      </Field>

      <Field label="Additional Build Plate Item" required="indicator">
        <Select
          value={printRequestSquareSettingsForm.fields.additionalBuildPlateItemId.value()}
          options={squareItemOptions}
          placeholder="Select Item"
          onChange={(value) =>
            printRequestSquareSettingsForm.fields.additionalBuildPlateItemId.set(value)}
        />
        <input
          hidden
          {...printRequestSquareSettingsForm.fields.additionalBuildPlateItemId.as('text')}
        />
      </Field>
    </Stack>
  </form>
{/if}
