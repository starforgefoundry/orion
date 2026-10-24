<script lang="ts">
  import { Spinner } from '$lib/components/ui/spinner';
  import FormField from '$lib/frontend/components/form/FormField.svelte';
  import HiddenField from '$lib/frontend/components/form/HiddenField.svelte';
  import NumberStepper from '$lib/frontend/components/form/NumberStepper.svelte';
  import PriceInput from '$lib/frontend/components/form/PriceInput.svelte';
  import { initForm } from '$lib/frontend/components/form/utils.svelte';
  import ModalForm from '$lib/frontend/components/ModalForm.svelte';
  import PaymentBreakdown from '$lib/frontend/components/PaymentBreakdown.svelte';
  import { enhanceWithToast } from '$lib/frontend/form-submit';
  import type { PrintRequestDto } from '$lib/remotes/dtos/print_request.dto';
  import { getPricingInfo, upsertPaymentForm } from '$lib/remotes/endpoints/print_payment.remote';
  import { printBill } from '$lib/utils/print_pricing';
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

  let pricingInfo = $derived(
    getPricingInfo({ customerEmail: request.email, billingCode: request.billingCode ?? undefined }),
  );

  let bill = $derived(
    pricingInfo.current &&
      printBill(
        {
          materialType: request.material.materialType,
          materialCost,
          buildPlates,
          isMember: pricingInfo.current.isMember,
          billedToOrganization: pricingInfo.current.organizationName !== null,
        },
        pricingInfo.current.pricing,
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
  canSubmit={!!bill}
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
  {:else if bill}
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

    <div class="rounded-lg border p-3">
      <h3 class="mb-2 text-sm font-medium">Summary</h3>
      <PaymentBreakdown lineItems={bill.lineItems} discounts={bill.discounts} total={bill.total} />
      {#if pricingInfo.current?.organizationName}
        <p class="mt-2 text-xs text-muted-foreground">
          Billed to {pricingInfo.current.organizationName}. The customer is not emailed a payment
          link.
        </p>
      {/if}
    </div>
  {/if}
</ModalForm>
