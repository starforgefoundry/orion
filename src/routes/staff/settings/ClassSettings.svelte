<script lang="ts">
  import TextInput from '$lib/frontend/components/form/TextInput.svelte';
  import { initForm } from '$lib/frontend/components/form/utils.svelte';
  import { enhanceWithToast } from '$lib/frontend/form-submit';
  import { classSettingsForm } from '$lib/remotes/endpoints/settings.remote';
  import FormField from '$lib/frontend/components/form/FormField.svelte';

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
</script>

<form
  id={formId}
  {...enhanceWithToast(classSettingsForm, {
    success: 'Class settings saved',
    error: 'Error saving settings',
  })}
>
  <div class="flex flex-col gap-5">
    <FormField
      label="Discord Webhook URL"
      description="Webhook URL for Discord notifications when a class is booked"
    >
      <TextInput
        {...classSettingsForm.fields.discordWebhookUrl.as('text')}
        placeholder="https://discord.com/api/webhooks/..."
      />
    </FormField>
  </div>
</form>
