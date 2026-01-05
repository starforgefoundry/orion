<script lang="ts">
  import PriceInput from '$lib/frontend/components/form/PriceInput.svelte';
  import { initForm } from '$lib/frontend/components/form/utils.svelte';
  import { toFixedDown } from '$lib/frontend/components/utils';
  import type { PrintRequestDto } from '$lib/remotes/dtos/print_request.dto';
  import { getPricingInfo, upsertPaymentForm } from '$lib/remotes/endpoints/print_payment.remote';
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
    toastManager,
  } from '@immich/ui';
  import { mdiCurrencyUsd } from '@mdi/js';

  interface Props {
    request: PrintRequestDto;
    prefill?: {
      buildPlates: number;
      materialCost: number;
    };
    billingType: string;
    isEdit?: boolean;
    onClose: (created?: boolean) => void;
  }

  let {
    onClose,
    request,
    prefill = { buildPlates: 1, materialCost: 300 },
    isEdit = false,
    billingType,
  }: Props = $props();

  initForm(upsertPaymentForm, () => ({
    requestId: request.id,
    materialCost: prefill.materialCost,
    buildPlates: prefill.buildPlates,
  }));

  let materialCost = $derived(prefill.materialCost);
  $effect(() => {
    upsertPaymentForm.fields.materialCost.set(materialCost);
  });
  let buildPlates = $derived(prefill.buildPlates);
  $effect(() => {
    upsertPaymentForm.fields.buildPlates.set(buildPlates);
  });

  // Cost Calculations
  let pricingInfo = $derived(getPricingInfo(request.email));
  let buildPlateCost = $derived((pricingInfo.current?.additionalBuildPlateModifier ?? 0) / 100);
  let buildPlateSurcharge = $derived(buildPlates > 1 ? (buildPlates - 1) * buildPlateCost : 0);
  let subtotal = $derived(materialCost / 100 + buildPlateSurcharge);
  let memberDiscount = $derived(
    pricingInfo.current?.memberDiscountApplied
      ? (subtotal * (pricingInfo.current?.memberPrintDiscount ?? 0)) / 100
      : 0,
  );
  let totalCost = $derived(subtotal - memberDiscount);

  let loading = $state(false);

  async function handleSubmit(submit: () => Promise<void>) {
    loading = true;
    try {
      await submit();
      toastManager.success('Payment created successfully');
      onClose(true);
    } catch (error) {
      toastManager.danger('Failed to create payment: ' + (error as Error).message);
    } finally {
      loading = false;
    }
  }
</script>

<Modal title="Create Payment" icon={mdiCurrencyUsd} {onClose}>
  <ModalBody>
    {#if pricingInfo.loading}
      <LoadingSpinner />
    {:else if pricingInfo.error}
      <Text color="danger">Error loading pricing info: {pricingInfo.error.message}</Text>
    {:else}
      <form {...upsertPaymentForm.enhance(({ submit }) => handleSubmit(submit))}>
        <input {...upsertPaymentForm.fields.requestId.as('text')} value={request.id} hidden />

        <Field label="Print Material Cost">
          <PriceInput bind:value={materialCost} multiplier={100} />
          <input {...upsertPaymentForm.fields.materialCost.as('number')} hidden />
        </Field>

        <Field label="Build Plates" class="mt-4">
          <NumberInput min="1" step="1" required bind:value={buildPlates} />
          <input {...upsertPaymentForm.fields.buildPlates.as('number')} hidden />
        </Field>

        <Heading class="mt-4 mb-2">Summary</Heading>
        <Stack>
          <HStack class="justify-between">
            <Stack gap={0}>
              <Text>Material Cost</Text>
            </Stack>
            <Text>${(materialCost / 100).toFixed(2)}</Text>
          </HStack>
          {#if buildPlates > 1}
            <HStack class="justify-between">
              <Stack gap={0}>
                <Text>Additional Build Plates ({buildPlates - 1}x)</Text>
                <Text size="small" color="muted">
                  ${buildPlateCost.toFixed(2)}/ea over 1 plate
                </Text>
              </Stack>
              <Text>
                ${buildPlateSurcharge.toFixed(2)}
              </Text>
            </HStack>
          {/if}

          {#if pricingInfo.current?.memberDiscountApplied}
            <HStack class="justify-between">
              <Stack gap={0}>
                <Text>Member Discount</Text>
                <Text size="small" color="muted">
                  {pricingInfo.current?.memberPrintDiscount}% off
                </Text>
              </Stack>
              <Text>
                - ${memberDiscount.toFixed(2)}
              </Text>
            </HStack>
          {/if}

          <hr class="mt-1 mb-2 w-1/3 self-end border-slate-700" />

          <HStack class="justify-between">
            <Text fontWeight="bold">TOTAL</Text>
            <Text>
              ${toFixedDown(totalCost, 2)}
            </Text>
          </HStack>
        </Stack>

        <Button
          type="submit"
          variant="filled"
          fullWidth
          class="mt-4"
          leadingIcon={mdiCurrencyUsd}
          {loading}
        >
          {isEdit ? `Update` : `Create`}
          {billingType}
        </Button>
      </form>
    {/if}
  </ModalBody>
</Modal>
