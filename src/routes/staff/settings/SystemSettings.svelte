<script lang="ts">
  import { expiryFromInputValue, expiryToInputValue } from '$lib/frontend/announcement';
  import HiddenField from '$lib/frontend/components/form/HiddenField.svelte';
  import TextArea from '$lib/frontend/components/form/TextArea.svelte';
  import TextInput from '$lib/frontend/components/form/TextInput.svelte';
  import { initForm } from '$lib/frontend/components/form/utils.svelte';
  import { enhanceWithToast } from '$lib/frontend/form-submit';
  import { printRequestSettingsForm } from '$lib/remotes/endpoints/settings.remote';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import FormField from '$lib/frontend/components/form/FormField.svelte';

  interface Props {
    printRequestSettings: {
      isOpen: boolean;
      announcement: string;
      announcementUntil: string;
      maxUploadMB: number;
      allowedFileTypes: string;
      discordWebhookUrl: string;
    };
    formId?: string;
  }

  const DEFAULT_MAX_UPLOAD_MB = 100;

  const { printRequestSettings, formId = 'print-request-settings' }: Props = $props();

  initForm(printRequestSettingsForm, () => ({
    isOpen: printRequestSettings.isOpen,
    announcement: printRequestSettings.announcement,
    announcementUntil: printRequestSettings.announcementUntil,
    maxUploadMB: printRequestSettings.maxUploadMB,
    allowedFileTypes: printRequestSettings.allowedFileTypes,
    discordWebhookUrl: printRequestSettings.discordWebhookUrl,
  }));

  let isOpen = $derived(printRequestSettings.isOpen);
  let maxUpload = $derived(printRequestSettings.maxUploadMB);
  let announcementUntil = $derived(expiryToInputValue(printRequestSettings.announcementUntil));
</script>

<form
  id={formId}
  {...enhanceWithToast(printRequestSettingsForm, {
    success: 'Settings saved',
    error: 'Error saving settings',
  })}
>
  <div class="flex flex-col gap-5">
    <FormField
      label="Accept Print Requests"
      for="accept-print-requests"
      description="When disabled, the public print request form is replaced with a closed message."
    >
      <Switch id="accept-print-requests" bind:checked={isOpen} />
      <HiddenField field={printRequestSettingsForm.fields.isOpen} value={isOpen} />
    </FormField>

    <FormField
      label="Announcement Banner"
      description="Shown as a yellow banner at the top of the print request form. Leave blank to hide it."
    >
      <TextArea
        {...printRequestSettingsForm.fields.announcement.as('text')}
        class="h-24"
        placeholder="Prints submitted after Friday will not be ready until the following week."
      />
    </FormField>

    <FormField
      label="Show Announcement Until"
      description="The banner stops showing at this time. Leave blank to show it until you clear the text."
    >
      <Input type="datetime-local" class="sm:max-w-64" bind:value={announcementUntil} />
      <HiddenField
        field={printRequestSettingsForm.fields.announcementUntil}
        value={expiryFromInputValue(announcementUntil)}
      />
    </FormField>

    <FormField label="Max Upload Size (MB)" required>
      <Input type="number" class="sm:max-w-40" bind:value={maxUpload} />
      <HiddenField
        field={printRequestSettingsForm.fields.maxUploadMB}
        value={maxUpload ?? DEFAULT_MAX_UPLOAD_MB}
      />
    </FormField>

    <FormField
      label="Allowed File Types"
      required
      description="Comma-separated list of file extensions (e.g., .stl, .3mf, .obj)"
    >
      <TextInput
        {...printRequestSettingsForm.fields.allowedFileTypes.as('text')}
        placeholder=".stl, .3mf, .obj"
      />
    </FormField>

    <FormField
      label="Discord Webhook URL"
      description="Webhook URL for Discord notifications when print requests are submitted"
    >
      <TextInput
        {...printRequestSettingsForm.fields.discordWebhookUrl.as('text')}
        placeholder="https://discord.com/api/webhooks/..."
      />
    </FormField>
  </div>
</form>
