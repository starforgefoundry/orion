<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Separator } from '$lib/components/ui/separator';
  import { Spinner } from '$lib/components/ui/spinner';
  import { Switch } from '$lib/components/ui/switch';
  import FormField from '$lib/frontend/components/form/FormField.svelte';
  import OptionSelect, {
    type SelectOption,
  } from '$lib/frontend/components/form/OptionSelect.svelte';
  import ModalForm from '$lib/frontend/components/ModalForm.svelte';
  import type { ModalProps } from '$lib/frontend/components/utils';
  import { TAG_ID_LENGTH } from '$lib/remotes/dtos/print_materials.dto';
  import type { PrintMaterial } from '$lib/server/db/schema';
  import SpoolIcon from '@lucide/svelte/icons/spool';
  import { untrack } from 'svelte';
  import { MaterialEditor } from './material-editor.svelte';

  type Props = ModalProps & {
    material?: PrintMaterial;
  };

  const PLACEHOLDER = 'Select';

  let { material, onClose }: Props = $props();

  // Edits a copy taken when the modal opens so list refreshes don't reset the form.
  const editor = new MaterialEditor(untrack(() => material));

  async function save() {
    if (await editor.save()) onClose();
  }

  function toOptions(values: string[]): SelectOption[] {
    return values.map((value) => ({ value, label: value }));
  }
</script>

{#snippet swatch(hex: string | null)}
  {#if hex}
    <span class="size-3.5 shrink-0 rounded-full border" style={`background-color: ${hex}`}></span>
  {/if}
{/snippet}

<ModalForm
  title={editor.isNew ? 'New Print Material' : (material?.name ?? 'Print Material')}
  icon={SpoolIcon}
  {onClose}
  submitLabel={editor.isNew ? 'Create Material' : 'Save Changes'}
  canSubmit={editor.canSave}
  submitting={editor.saving}
  onSubmit={save}
>
  <FormField label="Name" for="material-name" required>
    <Input
      id="material-name"
      bind:value={editor.name}
      placeholder="e.g. PLA Basic - Black"
      autocomplete="off"
    />
  </FormField>

  <label class="flex items-center justify-between gap-4 rounded-lg border p-3">
    <span>
      <span class="block text-sm font-medium">Available</span>
      <span class="block text-sm text-muted-foreground">
        Customers can pick this material on the print request form.
      </span>
    </span>
    <Switch bind:checked={editor.available} />
  </label>

  <FormField
    label="Tag ID"
    for="material-tag-id"
    description="The {TAG_ID_LENGTH}-character code printed on the spool label."
    error={editor.tagValid ? undefined : `Must be exactly ${TAG_ID_LENGTH} characters`}
  >
    <Input
      id="material-tag-id"
      bind:value={editor.tagId}
      maxlength={TAG_ID_LENGTH}
      autocapitalize="characters"
      autocomplete="off"
      placeholder="Not set"
      class="font-mono uppercase sm:max-w-40"
    />
  </FormField>

  <Separator />

  <div class="flex items-center justify-between gap-2">
    <div>
      <h3 class="text-sm font-medium">Filament</h3>
      <p class="text-sm text-muted-foreground">Links this material to a Bambuddy filament.</p>
    </div>
    {#if editor.vendor}
      <Button variant="ghost" size="sm" onclick={() => editor.clearFilament()}>Clear</Button>
    {/if}
  </div>

  {#if editor.loading}
    <div class="flex justify-center py-4"><Spinner class="size-6" /></div>
  {:else if editor.error}
    <p class="text-sm text-destructive">
      Could not load filaments from Bambuddy: {editor.error.message}
    </p>
  {:else}
    <div class="grid gap-4 sm:grid-cols-3">
      <FormField label="Vendor">
        <OptionSelect
          options={toOptions(editor.vendorOptions)}
          value={editor.vendor ?? ''}
          onValueChange={(value) => editor.selectVendor(value)}
          placeholder={PLACEHOLDER}
        />
      </FormField>

      <FormField label="Type">
        <OptionSelect
          options={toOptions(editor.materialOptions)}
          value={editor.materialType ?? ''}
          onValueChange={(value) => editor.selectMaterial(value)}
          disabled={!editor.vendor}
          placeholder={PLACEHOLDER}
        />
      </FormField>

      <FormField label="Color">
        <OptionSelect
          options={toOptions(editor.colors.map((color) => color.name))}
          value={editor.colorName ?? ''}
          onValueChange={(value) => editor.selectColor(value)}
          placeholder={PLACEHOLDER}
          disabled={!editor.materialType}
        >
          {#snippet item(option)}
            {@render swatch(
              editor.colors.find((color) => color.name === option.value)?.hex ?? null,
            )}
            <span class="truncate">{option.label}</span>
          {/snippet}
        </OptionSelect>
      </FormField>
    </div>
    {#if !editor.filamentValid}
      <p class="text-sm text-destructive">Pick a vendor, type and color, or clear the filament.</p>
    {/if}
  {/if}
</ModalForm>
