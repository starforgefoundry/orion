<script lang="ts">
  import PriceInput from '$lib/frontend/components/form/PriceInput.svelte';
  import TextInput from '$lib/frontend/components/form/TextInput.svelte';
  import type { ModalProps } from '$lib/frontend/components/utils';
  import { createPrintMaterialForm } from '$lib/remotes/endpoints/print_materials.remote';
  import { Button, Field, Modal, ModalBody, Stack, Switch } from '@immich/ui';
  import { mdiPaperRoll } from '@mdi/js';

  let { onClose }: ModalProps = $props();

  let available = $state(true);
  $effect(() => {
    createPrintMaterialForm.fields.available.set(available);
  });

  let cost = $state(0);
  $effect(() => {
    createPrintMaterialForm.fields.cost.set(cost);
  });
</script>

<Modal title="Create Print Material" icon={mdiPaperRoll} {onClose}>
  <ModalBody>
    <form {...createPrintMaterialForm} onsubmit={() => onClose()}>
      <Stack gap={4}>
        <Field label="Material Name" required="indicator">
          <TextInput
            {...createPrintMaterialForm.fields.name.as('text')}
            placeholder="e.g., PLA, ABS, PETG"
          />
        </Field>
        <Field label="Material Cost per gram" required="indicator">
          <PriceInput bind:value={cost} placeholder="0.02" />
          <input
            {...createPrintMaterialForm.fields.cost.as('number')}
            value={Math.round(cost * 100)}
            step="0.01"
            hidden
          />
        </Field>
        <Field label="Material Available">
          <Switch bind:checked={available} />
          <input {...createPrintMaterialForm.fields.available.as('checkbox')} hidden />
        </Field>
        <Button type="submit" variant="filled" fullWidth>Create Print Material</Button>
      </Stack>
    </form>
  </ModalBody>
</Modal>
