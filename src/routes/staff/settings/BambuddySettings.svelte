<script lang="ts">
  import TextInput from '$lib/frontend/components/form/TextInput.svelte';
  import { initForm } from '$lib/frontend/components/form/utils.svelte';
  import { bambuddySettingsForm } from '$lib/remotes/endpoints/settings.remote';
  import { Field, Stack, toastManager } from '@immich/ui';

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

  async function handleSubmit(submit: () => Promise<void>) {
    try {
      await submit();
      toastManager.show({
        title: 'Settings Saved',
        description: 'Bambuddy settings have been updated successfully.',
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
  {...bambuddySettingsForm.enhance(async ({ submit }) => await handleSubmit(submit))}
>
  <Stack gap={4}>
    <Field
      label="Server URL"
      required="indicator"
      description="Base URL of the Bambuddy server that talks to the printers."
    >
      <TextInput
        {...bambuddySettingsForm.fields.serverUrl.as('text')}
        placeholder="https://print.example.com"
      />
    </Field>

    <Field
      label="API Key"
      description={bambuddySettings.hasApiKey
        ? 'A key is saved. Leave blank to keep it, or paste a new one to replace it.'
        : 'Create a long-lived token in Bambuddy and paste it here.'}
    >
      <TextInput
        {...bambuddySettingsForm.fields.apiKey.as('password')}
        placeholder={bambuddySettings.hasApiKey ? '••••••••' : 'bb_...'}
      />
    </Field>
  </Stack>
</form>
