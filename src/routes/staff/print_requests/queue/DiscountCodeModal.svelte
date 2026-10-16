<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Spinner } from '$lib/components/ui/spinner';
  import FormField from '$lib/frontend/components/form/FormField.svelte';
  import OptionSelect from '$lib/frontend/components/form/OptionSelect.svelte';
  import Modal from '$lib/frontend/components/Modal.svelte';
  import type { ModalProps } from '$lib/frontend/components/utils';
  import { getBillingCodes } from '$lib/remotes/endpoints/billing_code.remote';
  import TagIcon from '@lucide/svelte/icons/tag';

  type Props = ModalProps & {
    currentCode: string;
    onSave: (code: string) => void;
  };

  let { currentCode, onSave, onClose }: Props = $props();

  let billingCodes = getBillingCodes();

  let options = $derived(
    billingCodes.current?.map((bc) => {
      let label = bc.code;
      const details: string[] = [];
      if (bc.organizationName) details.push(bc.organizationName);
      if (bc.discountName) details.push(bc.discountName);
      if (details.length > 0) label += ` (${details.join(' - ')})`;
      return { value: bc.code, label };
    }) ?? [],
  );

  let selectedValue = $derived(currentCode);

  function save() {
    onSave(selectedValue);
    onClose();
  }
</script>

<Modal title="Edit Discount Code" icon={TagIcon} size="sm" {onClose}>
  {#if billingCodes.loading}
    <div class="flex justify-center py-6">
      <Spinner class="size-6" />
    </div>
  {:else}
    <FormField label="Discount Code">
      <OptionSelect
        {options}
        bind:value={selectedValue}
        noneLabel="No Discount Code"
        placeholder="Select a billing code"
      />
    </FormField>
  {/if}

  {#snippet footer()}
    <Button disabled={billingCodes.loading} onclick={save}>Save</Button>
  {/snippet}
</Modal>
