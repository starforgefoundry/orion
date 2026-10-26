<script lang="ts">
  import FormField from '$lib/frontend/components/form/FormField.svelte';
  import HiddenField from '$lib/frontend/components/form/HiddenField.svelte';
  import NumberStepper from '$lib/frontend/components/form/NumberStepper.svelte';
  import PriceInput from '$lib/frontend/components/form/PriceInput.svelte';
  import { initForm } from '$lib/frontend/components/form/utils.svelte';
  import { enhanceWithToast } from '$lib/frontend/form-submit';
  import { printPricingSettingsForm } from '$lib/remotes/endpoints/settings.remote';
  import { CENTS_PER_DOLLAR } from '$lib/utils/billing';
  import type { PrintPricing } from '$lib/utils/print_pricing';

  const MAX_PERCENT = 100;

  interface Props {
    pricing: PrintPricing;
    formId?: string;
  }

  let { pricing, formId = 'print-pricing-settings' }: Props = $props();

  initForm(printPricingSettingsForm, () => ({ ...pricing }));

  let additionalBuildPlatePrice = $derived(pricing.additionalBuildPlatePrice);
  let memberDiscountPercent = $derived(pricing.memberDiscountPercent);
</script>

<form
  id={formId}
  class="flex flex-col gap-5"
  {...enhanceWithToast(printPricingSettingsForm, {
    success: 'Print pricing saved',
    error: 'Error saving print pricing',
  })}
>
  <FormField
    label="Additional Build Plate Price"
    description="Charged for each build plate after the first."
  >
    <PriceInput bind:value={additionalBuildPlatePrice} multiplier={CENTS_PER_DOLLAR} />
    <HiddenField
      field={printPricingSettingsForm.fields.additionalBuildPlatePrice}
      value={additionalBuildPlatePrice}
    />
  </FormField>

  <FormField
    label="Member Discount (%)"
    description="Taken off prints for customers whose email has an active membership. Prints billed to an organization don't get it."
  >
    <NumberStepper bind:value={memberDiscountPercent} min={0} max={MAX_PERCENT} />
    <HiddenField
      field={printPricingSettingsForm.fields.memberDiscountPercent}
      value={memberDiscountPercent}
    />
  </FormField>
</form>
