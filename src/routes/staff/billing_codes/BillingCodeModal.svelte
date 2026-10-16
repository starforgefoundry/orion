<script lang="ts">
  import { Spinner } from '$lib/components/ui/spinner';
  import ModalForm from '$lib/frontend/components/ModalForm.svelte';
  import FormField from '$lib/frontend/components/form/FormField.svelte';
  import HiddenField from '$lib/frontend/components/form/HiddenField.svelte';
  import OptionSelect, {
    type SelectOption,
  } from '$lib/frontend/components/form/OptionSelect.svelte';
  import TextInput from '$lib/frontend/components/form/TextInput.svelte';
  import type { ModalProps } from '$lib/frontend/components/utils';
  import { enhanceWithToast } from '$lib/frontend/form-submit';
  import { createBillingCode } from '$lib/remotes/endpoints/billing_code.remote';
  import { getOrganizations } from '$lib/remotes/endpoints/organization.remote';
  import { getSquareCatalog } from '$lib/remotes/endpoints/square.remote';
  import TicketIcon from '@lucide/svelte/icons/ticket';

  const NONE = '';

  type Props = ModalProps;

  let { onClose }: Props = $props();

  let organizations = getOrganizations();
  let catalogRequest = getSquareCatalog();

  let organizationOptions: SelectOption[] = $derived(
    organizations.current?.map((organization) => ({
      value: organization.id,
      label: organization.name,
    })) ?? [],
  );

  let squareCatalog = $derived(catalogRequest.current ?? []);
  let squareDiscountOptions: SelectOption[] = $derived(
    squareCatalog
      .filter((item) => item.type === 'DISCOUNT')
      .map((item) => ({
        label: item.discountData?.name || 'Unnamed Discount',
        value: item.id,
      })),
  );

  let selectedOrganization = $state(NONE);
  let selectedDiscount = $state(NONE);

  let validSubmit = $derived(selectedOrganization !== NONE || selectedDiscount !== NONE);
</script>

<ModalForm
  title="Create Billing Code"
  icon={TicketIcon}
  {onClose}
  submitLabel="Create Billing Code"
  canSubmit={validSubmit}
  submitting={createBillingCode.pending > 0}
  form={enhanceWithToast(
    createBillingCode,
    { success: 'Billing code created', error: 'Failed to create billing code' },
    onClose,
  )}
>
  {#if organizations.loading || catalogRequest.loading}
    <div class="flex justify-center py-8">
      <Spinner class="size-6" />
    </div>
  {:else}
    <FormField label="Code" required>
      <TextInput {...createBillingCode.fields.code.as('text')} placeholder="e.g., ENGCLUB2024" />
    </FormField>

    <FormField label="Description" required>
      <TextInput
        {...createBillingCode.fields.description.as('text')}
        placeholder="e.g., Engineering Club Discount"
      />
    </FormField>

    <FormField label="Bill to Organization">
      <OptionSelect
        options={organizationOptions}
        bind:value={selectedOrganization}
        noneLabel="No Organization"
      />
      <HiddenField field={createBillingCode.fields.organizationId} value={selectedOrganization} />
    </FormField>

    <FormField label="Apply Discount">
      <OptionSelect
        options={squareDiscountOptions}
        bind:value={selectedDiscount}
        noneLabel="No Discount"
      />
      <HiddenField field={createBillingCode.fields.discountId} value={selectedDiscount} />
    </FormField>
  {/if}
</ModalForm>
