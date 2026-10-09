<script lang="ts">
  import TextInput from '$lib/frontend/components/form/TextInput.svelte';
  import type { ModalProps } from '$lib/frontend/components/utils';
  import { createBillingCode } from '$lib/remotes/endpoints/billing_code.remote';
  import { getOrganizations } from '$lib/remotes/endpoints/organization.remote';
  import { getSquareCatalog } from '$lib/remotes/endpoints/square.remote';
  import {
    Button,
    Field,
    LoadingSpinner,
    Modal,
    ModalBody,
    Select,
    Stack,
    type SelectOption,
  } from '@immich/ui';
  import { mdiTicket } from '@mdi/js';

  type Props = ModalProps;

  let { onClose }: Props = $props();

  let organizations = getOrganizations();
  let catalogRequest = getSquareCatalog();

  let organizationOptions: SelectOption[] = $derived([
    { value: '', label: 'No Organization' },
    ...(organizations.current?.map((organization) => ({
      value: organization.id,
      label: organization.name,
    })) || []),
  ]);

  let squareCatalog = $derived(catalogRequest.current ?? []);
  let squareDiscountOptions: SelectOption[] = $derived([
    { value: '', label: 'No Discount' },
    ...squareCatalog
      .filter((item) => item.type === 'DISCOUNT')
      .map((item) => ({
        label: item.discountData?.name || 'Unnamed Discount',
        value: item.id,
      })),
  ]);

  let selectedOrganization = $state('');
  let selectedDiscount = $state('');

  $effect(() => {
    createBillingCode.fields.organizationId.set(selectedOrganization);
  });

  $effect(() => {
    createBillingCode.fields.discountId.set(selectedDiscount);
  });

  let validSubmit = $derived(selectedOrganization !== '' || selectedDiscount !== '');
</script>

<Modal title="Create Billing Code" icon={mdiTicket} {onClose}>
  <ModalBody>
    {#if organizations.loading || catalogRequest.loading}
      <div class="flex justify-center py-8">
        <LoadingSpinner size="large" />
      </div>
    {:else}
      <form {...createBillingCode} onsubmit={() => onClose()}>
        <Stack gap={4}>
          <Field label="Code" required="indicator">
            <TextInput
              {...createBillingCode.fields.code.as('text')}
              placeholder="e.g., ENGCLUB2024"
            />
          </Field>

          <Field label="Description" required="indicator">
            <TextInput
              {...createBillingCode.fields.description.as('text')}
              placeholder="e.g., Engineering Club Discount"
            />
          </Field>

          <Field label="Bill to Organization">
            <Select
              options={organizationOptions}
              bind:value={selectedOrganization}
              placeholder="Select an organization"
            />
            <input {...createBillingCode.fields.organizationId.as('text')} hidden />
          </Field>

          <Field label="Apply Discount">
            <Select
              options={squareDiscountOptions}
              bind:value={selectedDiscount}
              placeholder="Select a discount"
            />
            <input {...createBillingCode.fields.discountId.as('text')} hidden />
          </Field>

          <Button type="submit" variant="filled" fullWidth disabled={!validSubmit}
            >Create Billing Code</Button
          >
        </Stack>
      </form>
    {/if}
  </ModalBody>
</Modal>
