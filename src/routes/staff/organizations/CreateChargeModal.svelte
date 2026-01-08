<script lang="ts">
  import PriceInput from '$lib/frontend/components/form/PriceInput.svelte';
  import TextArea from '$lib/frontend/components/form/TextArea.svelte';
  import type { ModalProps } from '$lib/frontend/components/utils';
  import { createOrganizationChargeForm } from '$lib/remotes/endpoints/organization.remote';
  import { Button, Field, Modal, ModalBody, Stack, Switch } from '@immich/ui';
  import { mdiAccountGroup } from '@mdi/js';

  interface Props extends ModalProps {
    orgId: string;
  }

  const { onClose, orgId }: Props = $props();

  let amountInput = $derived(0);
  let isCredit = $state(false);
  let amount = $derived(amountInput * (isCredit ? -1 : 1));
  $effect(() => {
    createOrganizationChargeForm.fields.amount.set(amount);
  });
</script>

<Modal {onClose} title="Create Organization Charge" icon={mdiAccountGroup}>
  <ModalBody>
    <form {...createOrganizationChargeForm} onsubmit={() => onClose()}>
      <input
        hidden
        {...createOrganizationChargeForm.fields.organizationId.as('text')}
        value={orgId}
      />

      <Stack gap={4}>
        <Field label="Amount" required="indicator">
          <PriceInput bind:value={amountInput} multiplier={100} />
          <input {...createOrganizationChargeForm.fields.amount.as('number')} hidden />
        </Field>

        <Field
          label="Credit Charge"
          description="Toggle if this charge is a credit to the organization."
        >
          <Switch bind:checked={isCredit} />
        </Field>

        <Field label="Description" required="indicator">
          <TextArea
            required
            placeholder="Description for the charge"
            {...createOrganizationChargeForm.fields.description.as('text')}
          />
        </Field>

        <Button type="submit" variant="filled" fullWidth disabled={amountInput === 0}>
          Create Charge
        </Button>
      </Stack>
    </form>
  </ModalBody>
</Modal>
