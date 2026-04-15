<script lang="ts">
  import type { ModalProps } from '$lib/frontend/components/utils';
  import { getBillingCodes } from '$lib/remotes/endpoints/billing_code.remote';
  import {
    Button,
    Field,
    LoadingSpinner,
    Modal,
    ModalBody,
    Select,
    Stack,
    type SelectItem,
  } from '@immich/ui';
  import { mdiTag } from '@mdi/js';

  type Props = ModalProps & {
    currentCode: string;
    onSave: (code: string) => void;
  };

  let { currentCode, onSave, onClose }: Props = $props();

  let billingCodes = getBillingCodes();

  let options: SelectItem[] = $derived([
    { value: '', label: 'No Discount Code' },
    ...(billingCodes.current?.map((bc) => {
      let label = bc.code;
      const details: string[] = [];
      if (bc.organizationName) details.push(bc.organizationName);
      if (bc.discountName) details.push(bc.discountName);
      if (details.length > 0) label += ` (${details.join(' - ')})`;
      return { value: bc.code, label };
    }) ?? []),
  ]);

  let selectedValue = $state<SelectItem | undefined>(undefined);
  let initialized = $state(false);

  // Initialize selectedValue once billing codes have loaded so we can find
  // the matching option for the current code
  $effect(() => {
    if (initialized || billingCodes.loading) return;
    if (!currentCode) {
      selectedValue = { value: '', label: 'No Discount Code' };
    } else {
      selectedValue = options.find((o) => o.value === currentCode) ?? {
        value: '',
        label: 'No Discount Code',
      };
    }
    initialized = true;
  });
</script>

<Modal title="Edit Discount Code" icon={mdiTag} {onClose}>
  <ModalBody>
    {#if billingCodes.loading}
      <div class="flex justify-center py-8">
        <LoadingSpinner size="large" />
      </div>
    {:else}
      <Stack gap={4}>
        <Field label="Discount Code">
          <Select data={options} bind:value={selectedValue} placeholder="Select a billing code" />
        </Field>
        <Button
          variant="filled"
          fullWidth
          onclick={() => {
            onSave(selectedValue?.value ?? '');
            onClose();
          }}
        >
          Save
        </Button>
      </Stack>
    {/if}
  </ModalBody>
</Modal>
