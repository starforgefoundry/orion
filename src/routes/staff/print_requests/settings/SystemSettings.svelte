<script lang="ts">
  import TextInput from '$lib/frontend/components/form/TextInput.svelte';
  import { initForm } from '$lib/frontend/components/form/utils.svelte';
  import { printRequestSettingsForm } from '$lib/remotes/endpoints/settings.remote';
  import {
    Button,
    Card,
    CardBody,
    Field,
    Heading,
    NumberInput,
    Stack,
    toastManager,
  } from '@immich/ui';

  interface Props {
    printRequestSettings: {
      maxUploadMB: number;
      allowedFileTypes: string;
      discordWebhookUrl: string;
    };
  }

  const { printRequestSettings }: Props = $props();

  initForm(printRequestSettingsForm, () => ({
    maxUploadMB: printRequestSettings.maxUploadMB,
    allowedFileTypes: printRequestSettings.allowedFileTypes,
    discordWebhookUrl: printRequestSettings.discordWebhookUrl,
  }));

  let maxUpload = $derived(printRequestSettings.maxUploadMB);
  $effect(() => {
    printRequestSettingsForm.fields.maxUploadMB.set(maxUpload ?? 100);
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

<!-- Print Request Settings -->
<Card>
  <CardBody>
    <Heading size="medium" class="mb-4">Print Request Settings</Heading>

    <!-- Disable form reset -->
    <form {...printRequestSettingsForm.enhance(async ({ submit }) => await handleSubmit(submit))}>
      <Stack gap={4}>
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

        <Button type="submit" variant="filled" fullWidth>Save Print Request Settings</Button>
      </Stack>
    </form>
  </CardBody>
</Card>
