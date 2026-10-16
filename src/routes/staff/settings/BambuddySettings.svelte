<script lang="ts">
  import TextInput from '$lib/frontend/components/form/TextInput.svelte';
  import { initForm } from '$lib/frontend/components/form/utils.svelte';
  import { enhanceWithToast } from '$lib/frontend/form-submit';
  import { bambuddySettingsForm } from '$lib/remotes/endpoints/settings.remote';
  import FormField from '$lib/frontend/components/form/FormField.svelte';

  interface Props {
    bambuddySettings: {
      serverUrl: string;
      hasApiKey: boolean;
    };
    formId?: string;
  }

  const { bambuddySettings, formId = 'bambuddy-settings' }: Props = $props();

  initForm(bambuddySettingsForm, () => ({
    serverUrl: bambuddySettings.serverUrl,
    apiKey: '',
  }));
</script>

<form
  id={formId}
  {...enhanceWithToast(bambuddySettingsForm, {
    success: 'Bambuddy settings saved',
    error: 'Error saving settings',
  })}
>
  <div class="flex flex-col gap-5">
    <FormField
      label="Server URL"
      required
      description="Base URL of the Bambuddy server that talks to the printers."
    >
      <TextInput
        {...bambuddySettingsForm.fields.serverUrl.as('text')}
        placeholder="https://print.example.com"
      />
    </FormField>

    <FormField
      label="API Key"
      description={bambuddySettings.hasApiKey
        ? 'A key is saved. Leave blank to keep it, or paste a new one to replace it.'
        : 'Create a long-lived token in Bambuddy and paste it here.'}
    >
      <TextInput
        {...bambuddySettingsForm.fields.apiKey.as('password')}
        placeholder={bambuddySettings.hasApiKey ? '••••••••' : 'bb_...'}
      />
    </FormField>
  </div>
</form>
