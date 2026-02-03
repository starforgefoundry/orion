<script lang="ts">
  import { initForm } from '$lib/frontend/components/form/utils.svelte';
  import { printRequestSquareSettingsForm } from '$lib/remotes/endpoints/settings.remote';
  import { getSquareCatalog, getSquareLocations } from '$lib/remotes/endpoints/square.remote';
  import {
    Button,
    Card,
    CardBody,
    Field,
    Heading,
    HStack,
    IconButton,
    LoadingSpinner,
    modalManager,
    Select,
    Stack,
    toastManager,
    type SelectItem,
  } from '@immich/ui';
  import { mdiHelpCircle } from '@mdi/js';
  import SquareInfoModal from './SquareInfoModal.svelte';

  interface Props {
    squareSettings: {
      locationId: string;
      memberPrintDiscountId: string;
      printRequestItemId: string;
      additionalBuildPlateItemId: string;
    };
  }

  let { squareSettings }: Props = $props();

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
    })) as SelectItem[],
  );

  let catalogRequest = getSquareCatalog();
  let squareCatalog = $derived(catalogRequest.current ?? []);
  let squareItemOptions = $derived(
    squareCatalog
      .filter((item) => item.type === 'ITEM')
      .map((item) => ({
        label: item.itemData?.name || 'Unnamed Item',
        value: item.itemData?.variations?.[0]?.id || '',
      })) as SelectItem[],
  );
  let squareDiscountOptions = $derived(
    squareCatalog
      .filter((item) => item.type === 'DISCOUNT')
      .map((item) => ({
        label: item.discountData?.name || 'Unnamed Discount',
        value: item.id,
      })) as SelectItem[],
  );

  let selectedLocation = $derived(
    squareLocationOptions.find(
      (loc) => loc.value === printRequestSquareSettingsForm.fields.locationId.value(),
    ),
  );
  let selectedMaterialItem = $derived(
    squareItemOptions.find(
      (item) => item.value === printRequestSquareSettingsForm.fields.printRequestItemId.value(),
    ),
  );
  let selectedBuildPlateItem = $derived(
    squareItemOptions.find(
      (item) =>
        item.value === printRequestSquareSettingsForm.fields.additionalBuildPlateItemId.value(),
    ),
  );
  let selectedMemberDiscount = $derived(
    squareDiscountOptions.find(
      (disc) => disc.value === printRequestSquareSettingsForm.fields.memberPrintDiscountId.value(),
    ),
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

<Card>
  <CardBody>
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
      <HStack class="mb-4 justify-between">
        <Heading size="medium">Square Settings</Heading>
        <IconButton
          icon={mdiHelpCircle}
          variant="ghost"
          color="secondary"
          aria-label="Show Square Info"
          onclick={showSquareInfoModal}
        />
      </HStack>

      <!-- Disable form reset -->
      <form
        {...printRequestSquareSettingsForm.enhance(
          async ({ submit }) => await handleSubmit(submit),
        )}
      >
        <Stack gap={4}>
          <Field label="Location" required="indicator">
            <Select
              bind:value={selectedLocation}
              data={squareLocationOptions}
              placeholder="Square Location"
              onChange={(e) => printRequestSquareSettingsForm.fields.locationId.set(e.value)}
            />
            <input hidden {...printRequestSquareSettingsForm.fields.locationId.as('text')} />
          </Field>

          <Field label="Member Print Discount Item" required="indicator">
            <Select
              bind:value={selectedMemberDiscount}
              data={squareDiscountOptions}
              placeholder="Select Discount"
              onChange={(e) =>
                printRequestSquareSettingsForm.fields.memberPrintDiscountId.set(e.value)}
            />
            <input
              hidden
              {...printRequestSquareSettingsForm.fields.memberPrintDiscountId.as('text')}
            />
          </Field>

          <Field label="Print Request Item" required="indicator">
            <Select
              bind:value={selectedMaterialItem}
              data={squareItemOptions}
              placeholder="Select Item"
              onChange={(e) =>
                printRequestSquareSettingsForm.fields.printRequestItemId.set(e.value)}
            />
            <input
              hidden
              {...printRequestSquareSettingsForm.fields.printRequestItemId.as('text')}
            />
          </Field>

          <Field label="Additional Build Plate Item" required="indicator">
            <Select
              bind:value={selectedBuildPlateItem}
              data={squareItemOptions}
              placeholder="Select Item"
              onChange={(e) =>
                printRequestSquareSettingsForm.fields.additionalBuildPlateItemId.set(e.value)}
            />
            <input
              hidden
              {...printRequestSquareSettingsForm.fields.additionalBuildPlateItemId.as('text')}
            />
          </Field>

          <Button type="submit" variant="filled" fullWidth>Save Square Settings</Button>
        </Stack>
      </form>
    {/if}
  </CardBody>
</Card>
