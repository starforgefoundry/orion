<script lang="ts">
  import { Switch } from '$lib/components/ui/switch';
  import ModalForm from '$lib/frontend/components/ModalForm.svelte';
  import FormField from '$lib/frontend/components/form/FormField.svelte';
  import HiddenField from '$lib/frontend/components/form/HiddenField.svelte';
  import PriceInput from '$lib/frontend/components/form/PriceInput.svelte';
  import TextArea from '$lib/frontend/components/form/TextArea.svelte';
  import type { ModalProps } from '$lib/frontend/components/utils';
  import { enhanceWithToast } from '$lib/frontend/form-submit';
  import { createOrganizationChargeForm } from '$lib/remotes/endpoints/organization.remote';
  import HandCoinsIcon from '@lucide/svelte/icons/hand-coins';

  interface Props extends ModalProps {
    orgId: string;
  }

  const { onClose, orgId }: Props = $props();

  let amountInput = $state(0);
  let isCredit = $state(false);
  let amount = $derived(amountInput * (isCredit ? -1 : 1));
</script>

<ModalForm
  {onClose}
  title="Create Organization Charge"
  icon={HandCoinsIcon}
  submitLabel="Create Charge"
  canSubmit={amountInput !== 0}
  submitting={createOrganizationChargeForm.pending > 0}
  form={enhanceWithToast(
    createOrganizationChargeForm,
    { success: 'Charge created', error: 'Failed to create charge' },
    onClose,
  )}
>
  <input hidden {...createOrganizationChargeForm.fields.organizationId.as('text')} value={orgId} />

  <FormField label="Amount" required>
    <PriceInput bind:value={amountInput} multiplier={100} />
    <HiddenField field={createOrganizationChargeForm.fields.amount} value={amount} />
  </FormField>

  <FormField
    label="Credit Charge"
    for="charge-is-credit"
    description="Toggle if this charge is a credit to the organization."
  >
    <Switch id="charge-is-credit" bind:checked={isCredit} />
  </FormField>

  <FormField label="Description" required>
    <TextArea
      required
      placeholder="Description for the charge"
      {...createOrganizationChargeForm.fields.description.as('text')}
    />
  </FormField>
</ModalForm>
