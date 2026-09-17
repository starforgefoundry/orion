<script lang="ts">
  import { expiryFromInputValue, expiryToInputValue } from '$lib/frontend/announcement';
  import SecureInput from '$lib/frontend/components/form/SecureInput.svelte';
  import TextArea from '$lib/frontend/components/form/TextArea.svelte';
  import TextInput from '$lib/frontend/components/form/TextInput.svelte';
  import { initForm } from '$lib/frontend/components/form/utils.svelte';
  import { printRequestSettingsForm } from '$lib/remotes/endpoints/settings.remote';
  import { Field, Input, NumberInput, Stack, Switch, toastManager } from '@immich/ui';

  interface Props {
    printRequestSettings: {
      isOpen: boolean;
      announcement: string;
      announcementUntil: string;
      maxUploadMB: number;
      allowedFileTypes: string;
      discordWebhookUrl: string;
      bblAuthorizationToken: string;
      bblUserId: string;
    };
    formId?: string;
  }

  const { printRequestSettings, formId = 'print-request-settings' }: Props = $props();

  initForm(printRequestSettingsForm, () => ({
    isOpen: printRequestSettings.isOpen,
    announcement: printRequestSettings.announcement,
    announcementUntil: printRequestSettings.announcementUntil,
    maxUploadMB: printRequestSettings.maxUploadMB,
    allowedFileTypes: printRequestSettings.allowedFileTypes,
    discordWebhookUrl: printRequestSettings.discordWebhookUrl,
    bblAuthorizationToken: printRequestSettings.bblAuthorizationToken,
    bblUserId: printRequestSettings.bblUserId,
  }));

  let isOpen = $derived(printRequestSettings.isOpen);
  $effect(() => {
    printRequestSettingsForm.fields.isOpen.set(isOpen);
  });

  let maxUpload = $derived(printRequestSettings.maxUploadMB);
  $effect(() => {
    printRequestSettingsForm.fields.maxUploadMB.set(maxUpload ?? 100);
  });

  let announcementUntil = $derived(expiryToInputValue(printRequestSettings.announcementUntil));
  $effect(() => {
    printRequestSettingsForm.fields.announcementUntil.set(expiryFromInputValue(announcementUntil));
  });

  async function handleSubmit(submit: () => Promise<void>) {
    try {
      await submit();
      toastManager.show({
        title: 'Settings Saved',
        description: 'Settings have been updated successfully.',
        color: 'success',
      });
    } catch (error) {
      toastManager.show({
        title: 'Error Saving Settings',
        description: 'An error occurred while saving settings. Please try again.',
        color: 'danger',
      });
    }
  }
</script>

<form
  id={formId}
  {...printRequestSettingsForm.enhance(async ({ submit }) => await handleSubmit(submit))}
>
  <Stack gap={4}>
    <Field
      label="Accept Print Requests"
      description="When disabled, the public print request form is replaced with a closed message."
    >
      <Switch bind:checked={isOpen} />
      <input hidden {...printRequestSettingsForm.fields.isOpen.as('checkbox')} />
    </Field>

    <Field
      label="Announcement Banner"
      description="Shown as a yellow banner at the top of the print request form. Leave blank to hide it."
    >
      <TextArea
        {...printRequestSettingsForm.fields.announcement.as('text')}
        class="h-24"
        placeholder="Prints submitted after Friday will not be ready until the following week."
      />
    </Field>

    <Field
      label="Show Announcement Until"
      description="The banner stops showing at this time. Leave blank to show it until you clear the text."
    >
      <Input type="datetime-local" bind:value={announcementUntil} />
      <input hidden {...printRequestSettingsForm.fields.announcementUntil.as('text')} />
    </Field>

    <Field label="Max Upload Size (MB)" required="indicator">
      <NumberInput bind:value={maxUpload} />
      <input hidden {...printRequestSettingsForm.fields.maxUploadMB.as('number')} />
    </Field>

    <Field
      label="Allowed File Types"
      required="indicator"
      description="Comma-separated list of file extensions (e.g., .stl, .3mf, .obj)"
    >
      <TextInput
        {...printRequestSettingsForm.fields.allowedFileTypes.as('text')}
        placeholder=".stl, .3mf, .obj"
      />
    </Field>

    <Field
      label="Discord Webhook URL"
      description="Webhook URL for Discord notifications when print requests are submitted"
    >
      <TextInput
        {...printRequestSettingsForm.fields.discordWebhookUrl.as('text')}
        placeholder="https://discord.com/api/webhooks/..."
      />
    </Field>

    <Field label="Bambu User ID" description="Bambulab user ID for accessing printer data">
      <TextInput
        {...printRequestSettingsForm.fields.bblUserId.as('text')}
        placeholder="u_1234567890"
      />
    </Field>

    <Field
      label="Bambu Authorization Token"
      description="Bambulab authorization token for accessing printer data"
    >
      <SecureInput
        {...printRequestSettingsForm.fields.bblAuthorizationToken.as('text')}
        placeholder="Bambulab authorization token"
      />
    </Field>
  </Stack>
</form>
