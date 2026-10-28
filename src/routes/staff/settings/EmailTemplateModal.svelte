<script lang="ts" module>
  const PREVIEW_STYLE =
    '<style>body{font-family:system-ui,sans-serif;font-size:14px;line-height:1.5;color:#111;margin:16px}</style>';
</script>

<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Textarea } from '$lib/components/ui/textarea';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import FormField from '$lib/frontend/components/form/FormField.svelte';
  import Modal from '$lib/frontend/components/Modal.svelte';
  import type { ModalProps } from '$lib/frontend/components/utils';
  import type { EmailTemplate } from '$lib/server/db/schema';
  import { variableToken } from '$lib/utils/email_templates';
  import MailIcon from '@lucide/svelte/icons/mail';
  import { EmailTemplateEditor, TEMPLATE_FIELD } from './email-template-editor.svelte';

  type Props = ModalProps & { template: EmailTemplate };

  let { template, onClose }: Props = $props();

  // svelte-ignore state_referenced_locally
  const editor = new EmailTemplateEditor(template);

  async function close() {
    if (await editor.confirmDiscard()) onClose();
  }

  async function save() {
    if (await editor.save()) onClose();
  }
</script>

<Modal
  title={editor.definition.name}
  description={editor.definition.description}
  icon={MailIcon}
  size="full"
  {onClose}
  onDismiss={close}
>
  <div class="grid gap-4 lg:grid-cols-2">
    <div class="flex min-w-0 flex-col gap-4">
      <FormField label="Subject" for="template-subject" required>
        <Input
          id="template-subject"
          bind:ref={editor.fields[TEMPLATE_FIELD.SUBJECT]}
          bind:value={editor.subject}
          onfocus={() => editor.focus(TEMPLATE_FIELD.SUBJECT)}
        />
      </FormField>

      <div class="flex flex-col gap-1.5">
        <p class="text-sm font-medium">Variables</p>
        <p class="text-xs text-muted-foreground">
          Hover for details. Click to insert at the cursor.
        </p>
        <div class="flex flex-wrap gap-1.5">
          {#each editor.variables as variable (variable.name)}
            <Tooltip.Root>
              <Tooltip.Trigger>
                {#snippet child({ props })}
                  <Button
                    {...props}
                    variant="outline"
                    size="sm"
                    class="h-auto px-2 py-1 font-mono text-xs"
                    onclick={() => editor.insert(variable.token)}
                  >
                    {variable.token}
                  </Button>
                {/snippet}
              </Tooltip.Trigger>
              <Tooltip.Content class="max-w-64">
                {variable.description}
                <span class="block opacity-70">Preview: {variable.example}</span>
              </Tooltip.Content>
            </Tooltip.Root>
          {/each}
        </div>
      </div>

      <FormField label="Body (HTML)" for="template-body" required>
        <Textarea
          id="template-body"
          class="min-h-96 font-mono text-xs md:text-xs"
          bind:ref={editor.fields[TEMPLATE_FIELD.BODY]}
          bind:value={editor.body}
          onfocus={() => editor.focus(TEMPLATE_FIELD.BODY)}
        />
      </FormField>

      {#if editor.unknown.length > 0}
        <p class="text-sm text-destructive">
          Unknown variables: {editor.unknown.map(variableToken).join(', ')}
        </p>
      {/if}
    </div>

    <div class="flex min-w-0 flex-col gap-1.5">
      <p class="text-sm font-medium">Preview</p>
      <p class="text-xs text-muted-foreground">Variables are filled with sample values.</p>
      <div class="flex min-h-96 flex-1 flex-col overflow-hidden rounded-md border">
        <p class="border-b bg-muted/40 px-3 py-2 text-sm">
          <span class="text-muted-foreground">Subject:</span>
          {editor.preview.subject}
        </p>
        <iframe
          title="Email preview"
          sandbox=""
          class="w-full flex-1 bg-white"
          srcdoc={PREVIEW_STYLE + editor.preview.body}
        ></iframe>
      </div>
    </div>
  </div>

  {#snippet footer()}
    <Button variant="ghost" onclick={close}>Cancel</Button>
    <Button disabled={!editor.canSave} onclick={save}>Save Template</Button>
  {/snippet}
</Modal>
