<script lang="ts">
  import { Separator } from '$lib/components/ui/separator';
  import { Spinner } from '$lib/components/ui/spinner';
  import FormField from '$lib/frontend/components/form/FormField.svelte';
  import HiddenField from '$lib/frontend/components/form/HiddenField.svelte';
  import NumberStepper from '$lib/frontend/components/form/NumberStepper.svelte';
  import PriceInput from '$lib/frontend/components/form/PriceInput.svelte';
  import { initForm } from '$lib/frontend/components/form/utils.svelte';
  import ModalForm from '$lib/frontend/components/ModalForm.svelte';
  import { toFixedDown } from '$lib/frontend/components/utils';
  import { enhanceWithToast } from '$lib/frontend/form-submit';
  import type { PrintRequestDto } from '$lib/remotes/dtos/print_request.dto';
  import { getPricingInfo, upsertPaymentForm } from '$lib/remotes/endpoints/print_payment.remote';
  import DollarSignIcon from '@lucide/svelte/icons/dollar-sign';

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
  let buildPlates = $derived(prefill.buildPlates);

  // Cost Calculations
  let pricingInfo = $derived(
    getPricingInfo({ customerEmail: request.email, billingCode: request.billingCode ?? undefined }),
  );
  let buildPlateCost = $derived((pricingInfo.current?.additionalBuildPlateModifier ?? 0) / 100);
  let buildPlateSurcharge = $derived(buildPlates > 1 ? (buildPlates - 1) * buildPlateCost : 0);
  let subtotal = $derived(materialCost / 100 + buildPlateSurcharge);

  // Apply discounts sequentially (as Square does)
  let totalCost = $derived(
    (pricingInfo.current?.discounts ?? []).reduce(
      (price, discount) => price * (1 - discount.percentage / 100),
      subtotal,
    ),
  );

  let submitting = $derived(upsertPaymentForm.pending > 0);
</script>

<ModalForm
  title="{isEdit ? 'Update' : 'Create'} {billingType}"
  icon={DollarSignIcon}
  {onClose}
  submitLabel="{isEdit ? 'Update' : 'Create'} {billingType}"
  submitIcon={DollarSignIcon}
  canSubmit={!!pricingInfo.current}
  {submitting}
  form={enhanceWithToast(
    upsertPaymentForm,
    { success: 'Payment saved', error: 'Failed to save payment' },
    () => onClose(true),
  )}
>
  {#if pricingInfo.loading}
    <div class="flex justify-center py-6">
      <Spinner class="size-6" />
    </div>
  {:else if pricingInfo.error}
    <p class="text-sm text-destructive">Error loading pricing info: {pricingInfo.error.message}</p>
  {:else}
    <input {...upsertPaymentForm.fields.requestId.as('text')} value={request.id} hidden />

    <div class="grid gap-4 sm:grid-cols-2">
      <FormField label="Print Material Cost">
        <PriceInput bind:value={materialCost} multiplier={100} />
        <HiddenField field={upsertPaymentForm.fields.materialCost} value={materialCost} />
      </FormField>

      <FormField label="Build Plates">
        <NumberStepper bind:value={buildPlates} min={1} />
        <HiddenField field={upsertPaymentForm.fields.buildPlates} value={buildPlates} />
      </FormField>
    </div>

    <div class="rounded-lg border p-3 text-sm">
      <h3 class="mb-2 font-medium">Summary</h3>
      <dl class="flex flex-col gap-2">
        <div class="flex justify-between gap-3">
          <dt>Material Cost</dt>
          <dd class="tabular-nums">${(materialCost / 100).toFixed(2)}</dd>
        </div>
        <div class="flex justify-between gap-3">
          <dt>
            Additional Build Plates ({buildPlates - 1}x)
            <span class="block text-xs text-muted-foreground">
              ${buildPlateCost.toFixed(2)}/ea over 1 plate
            </span>
          </dt>
          <dd class="tabular-nums">${buildPlateSurcharge.toFixed(2)}</dd>
        </div>

        {#each pricingInfo.current?.discounts ?? [] as discount, i}
          {@const priceBeforeDiscount = (pricingInfo.current?.discounts ?? [])
            .slice(0, i)
            .reduce((price, d) => price * (1 - d.percentage / 100), subtotal)}
          {@const discountAmount = priceBeforeDiscount * (discount.percentage / 100)}
          <div class="flex justify-between gap-3">
            <dt>
              {discount.name}
              <span class="block text-xs text-muted-foreground">{discount.percentage}% off</span>
            </dt>
            <dd class="tabular-nums">- ${discountAmount.toFixed(2)}</dd>
          </div>
        {/each}

        <Separator />

        <div class="flex justify-between gap-3 font-semibold">
          <dt>Total</dt>
          <dd class="tabular-nums">${toFixedDown(totalCost, 2)}</dd>
        </div>
      </dl>
    </div>
  {/if}
</ModalForm>
