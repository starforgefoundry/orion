<script lang="ts">
  import TextInput from '$lib/frontend/components/form/TextInput.svelte';
  import {
    getPrintRequestSettings,
    getPrintRequestSquareSettings,
    printRequestSettingsForm,
    printRequestSquareSettingsForm,
  } from '$lib/remotes/endpoints/settings.remote';
  import {
    Button,
    Card,
    CardBody,
    Field,
    Heading,
    HStack,
    IconButton,
    modalManager,
    NumberInput,
    Stack,
  } from '@immich/ui';
  import { mdiHelpCircle } from '@mdi/js';
  import { onMount } from 'svelte';
  import SquareInfoModal from './SquareInfoModal.svelte';

  // Fetch initial settings
  let printRequestSettings = await getPrintRequestSettings();
  let squareSettings = await getPrintRequestSquareSettings();

  // Initialize form values when data loads
  onMount(() => {
    printRequestSettingsForm.fields.maxUploadMB.set(printRequestSettings.maxUploadMB);
    printRequestSettingsForm.fields.allowedFileTypes.set(printRequestSettings.allowedFileTypes);
    printRequestSquareSettingsForm.fields.locationId.set(squareSettings.locationId);
    printRequestSquareSettingsForm.fields.memberPrintDiscountId.set(
      squareSettings.memberPrintDiscountId,
    );
    printRequestSquareSettingsForm.fields.printRequestItemId.set(squareSettings.printRequestItemId);
    printRequestSquareSettingsForm.fields.additionalBuildPlateModifierId.set(
      squareSettings.additionalBuildPlateModifierId,
    );
  });

  let maxUpload = $state(printRequestSettings.maxUploadMB);
  $effect(() => {
    printRequestSettingsForm.fields.maxUploadMB.set(maxUpload ?? 100);
  });

  function showSquareInfoModal() {
    modalManager.show(SquareInfoModal);
  }
</script>

<div class="mb-6">
  <Heading size="large">Settings</Heading>
</div>

<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
  <!-- Print Request Settings -->
  <Card>
    <CardBody>
      <Heading size="medium" class="mb-4">Print Request Settings</Heading>

      <!-- Disable form reset -->
      <form {...printRequestSettingsForm.enhance(async ({ submit }) => submit())}>
        <Stack gap={4}>
          <Field label="Max Upload Size (MB)" required="indicator">
            <NumberInput bind:value={maxUpload} />
            <input hidden {...printRequestSettingsForm.fields.maxUploadMB.as('number')} />
          </Field>

          <Field
            label="Allowed File Types"
            required="indicator"
            description="Comma-separated list of file extensions (e.g., .stl, .3mf, .obj)"
          >
            <TextInput
              {...printRequestSettingsForm.fields.allowedFileTypes.as('text')}
              placeholder=".stl, .3mf, .obj"
            />
          </Field>

          <Button type="submit" variant="filled" fullWidth>Save Print Request Settings</Button>
        </Stack>
      </form>
    </CardBody>
  </Card>

  <!-- Square Settings -->
  <Card>
    <CardBody>
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
      <form {...printRequestSquareSettingsForm.enhance(async ({ submit }) => submit())}>
        <Stack gap={4}>
          <Field label="Location ID" required="indicator">
            <TextInput
              {...printRequestSquareSettingsForm.fields.locationId.as('text')}
              placeholder="Square Location ID"
            />
          </Field>

          <Field label="Member Print Discount ID" required="indicator">
            <TextInput
              {...printRequestSquareSettingsForm.fields.memberPrintDiscountId.as('text')}
              placeholder="Discount ID"
            />
          </Field>

          <Field label="Print Request Item ID" required="indicator">
            <TextInput
              {...printRequestSquareSettingsForm.fields.printRequestItemId.as('text')}
              placeholder="Item ID"
            />
          </Field>

          <Field label="Additional Build Plate Modifier ID" required="indicator">
            <TextInput
              {...printRequestSquareSettingsForm.fields.additionalBuildPlateModifierId.as('text')}
              placeholder="Modifier ID"
            />
          </Field>

          <Button type="submit" variant="filled" fullWidth>Save Square Settings</Button>
        </Stack>
      </form>
    </CardBody>
  </Card>
</div>
