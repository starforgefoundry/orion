<script lang="ts">
  import type { PrintRequestDto } from '$lib/remotes/dtos/print_request.dto';
  import { createPrintMaterialForm } from '$lib/remotes/endpoints/print_materials.remote';
  import { getPricingInfo } from '$lib/remotes/endpoints/print_payment.remote';
  import {
    Button,
    Field,
    Heading,
    HStack,
    LoadingSpinner,
    Modal,
    ModalBody,
    NumberInput,
    Stack,
    Text,
  } from '@immich/ui';
  import { mdiCurrencyUsd } from '@mdi/js';

  interface Props {
    request: PrintRequestDto;
    onClose: (created?: boolean) => void;
  }

  let { onClose, request }: Props = $props();
  let pricingInfo = $derived(getPricingInfo(request.id));

  let buildPlateCost = $derived((pricingInfo.current?.additionalBuildPlateModifier ?? 0) / 100);
  let materialCostPerGram = $derived(request.material.cost / 100);

  let buildPlateCount = $state(1);
  let materialGrams = $state(100);

  let buildPlateSurcharge = $derived(
    buildPlateCount > 1 ? (buildPlateCount - 1) * buildPlateCost : 0,
  );
  let materialCost = $derived(materialGrams * materialCostPerGram);
  let totalCost = $derived(materialCost + buildPlateSurcharge);
</script>

<Modal title="Create Payment" icon={mdiCurrencyUsd} {onClose}>
  <ModalBody>
    {#if pricingInfo.loading}
      <LoadingSpinner />
    {:else if pricingInfo.error}
      <Text color="danger">Error loading pricing info: {pricingInfo.error.message}</Text>
    {:else}
      <form {...createPrintMaterialForm} onsubmit={() => onClose(true)}>
        <Field label="Print Material (g)">
          <NumberInput min="0" step="1" required bind:value={materialGrams} />
        </Field>

        <Field label="Build Plates" class="mt-4">
          <NumberInput min="1" step="1" required bind:value={buildPlateCount} />
        </Field>

        <Heading class="mt-4 mb-2">Summary</Heading>
        <Stack>
          <HStack class="justify-between">
            <Stack gap={0}>
              <Text>Material Cost</Text>
              <Text size="small" color="muted">
                ${materialCostPerGram.toFixed(2)}/g
              </Text>
            </Stack>
            <Text>${materialCost.toFixed(2)}</Text>
          </HStack>
          <HStack class="justify-between">
            <Stack gap={0}>
              <Text>Build Plate Surcharge</Text>
              <Text size="small" color="muted">
                ${buildPlateCost.toFixed(2)}/ea over 1 plate
              </Text>
            </Stack>
            <Text>
              ${buildPlateSurcharge.toFixed(2)}
            </Text>
          </HStack>
          <hr class="mt-1 mb-2 w-1/3 self-end border-slate-700" />

          <HStack class="justify-between">
            <Text fontWeight="bold">TOTAL</Text>
            <Text>
              ${totalCost.toFixed(2)}
            </Text>
          </HStack>
        </Stack>

        <Button type="submit" variant="filled" fullWidth class="mt-4" leadingIcon={mdiCurrencyUsd}>
          Create Payment
        </Button>
      </form>
    {/if}
  </ModalBody>
</Modal>
