<script lang="ts">
  import TextInput from '$lib/frontend/components/form/TextInput.svelte';
  import { initForm } from '$lib/frontend/components/form/utils.svelte';
  import { classSettingsForm } from '$lib/remotes/endpoints/settings.remote';
  import { Field, Stack, toastManager } from '@immich/ui';

  interface Props {
    classSettings: {
      discordWebhookUrl: string;
    };
    formId?: string;
  }

  const { classSettings, formId = 'class-settings' }: Props = $props();

  initForm(classSettingsForm, () => ({
    discordWebhookUrl: classSettings.discordWebhookUrl,
  }));

  async function handleSubmit(submit: () => Promise<void>) {
    try {
      await submit();
      toastManager.show({
        title: 'Settings Saved',
        description: 'Class settings have been updated successfully.',
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
  {...classSettingsForm.enhance(async ({ submit }) => await handleSubmit(submit))}
>
  <Stack gap={4}>
    <Field
      label="Discord Webhook URL"
      description="Webhook URL for Discord notifications when a class is booked"
    >
      <TextInput
        {...classSettingsForm.fields.discordWebhookUrl.as('text')}
        placeholder="https://discord.com/api/webhooks/..."
      />
    </Field>
  </Stack>
</form>
