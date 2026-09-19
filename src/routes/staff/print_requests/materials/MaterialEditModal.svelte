<script lang="ts">
  import type { ModalProps } from '$lib/frontend/components/utils';
  import { TAG_ID_LENGTH } from '$lib/remotes/dtos/print_materials.dto';
  import type { PrintMaterial } from '$lib/server/db/schema';
  import {
    Button,
    Field,
    Input,
    LoadingSpinner,
    Modal,
    ModalBody,
    Select,
    Stack,
    Text,
  } from '@immich/ui';
  import { mdiPaperRoll } from '@mdi/js';
  import { untrack } from 'svelte';
  import { MaterialEditor } from './material-editor.svelte';

  type Props = ModalProps & {
    material: PrintMaterial;
  };

  let { material, onClose }: Props = $props();

  // The modal edits a copy taken when it opens; later row refreshes must not reset the form.
  const editor = new MaterialEditor(untrack(() => material));

  let saving = $state(false);

  async function save() {
    saving = true;
    if (await editor.save()) onClose();
    saving = false;
  }
</script>

<Modal title={material.name} icon={mdiPaperRoll} {onClose}>
  <ModalBody>
    <form
      onsubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <Stack gap={4}>
        <Field
          label="Tag ID"
          description="The {TAG_ID_LENGTH}-character code printed on the spool label."
        >
          <Input
            bind:value={editor.tagId}
            maxlength={TAG_ID_LENGTH}
            autocapitalize="characters"
            autocomplete="off"
            placeholder="Not set"
            class="font-mono"
          />
        </Field>

        {#if editor.loading}
          <div class="flex justify-center py-6"><LoadingSpinner size="large" /></div>
        {:else if editor.error}
          <Text color="danger">Could not load filaments from Bambuddy: {editor.error.message}</Text>
        {:else}
          <Field label="Vendor">
            <Select
              data={editor.vendorOptions}
              value={editor.selectedVendor}
              placeholder="Select a vendor"
              onChange={(item) => editor.selectVendor(item.value)}
            />
          </Field>

          <Field label="Material Type">
            <Select
              data={editor.materialOptions}
              value={editor.selectedMaterial}
              placeholder={editor.vendor ? 'Select a material' : 'Pick a vendor first'}
              onChange={(item) => editor.selectMaterial(item.value)}
            />
          </Field>

          <div class="flex items-end gap-2">
            <Field label="Color" class="grow">
              <Select
                data={editor.colorOptions}
                value={editor.selectedColor}
                placeholder={editor.materialType ? 'Select a color' : 'Pick a material first'}
                onChange={(item) => editor.selectColor(item.value)}
              />
            </Field>
            {#if editor.colorHex}
              <div
                class="size-11 shrink-0 rounded-lg border border-subtle"
                style={`background-color: ${editor.colorHex}`}
                title={editor.colorName}
              ></div>
            {/if}
          </div>
        {/if}

        <Button
          type="submit"
          fullWidth
          variant="filled"
          disabled={!editor.canSave}
          loading={saving}
        >
          Save
        </Button>
      </Stack>
    </form>
  </ModalBody>
</Modal>
