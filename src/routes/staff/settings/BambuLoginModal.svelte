<script lang="ts">
  import type { ModalProps } from '$lib/frontend/components/utils';
  import { Alert, Button, Field, Input, Modal, ModalBody, PasswordInput, Stack } from '@immich/ui';
  import { mdiPrinter3d } from '@mdi/js';
  import { BambuLoginManager } from './bambu-login-manager.svelte';

  let { onClose }: ModalProps = $props();

  const manager = new BambuLoginManager();
</script>

<Modal title="Refresh Bambu Lab Token" icon={mdiPrinter3d} {onClose}>
  <ModalBody>
    <form
      onsubmit={async (event) => {
        event.preventDefault();
        await manager.submit();
      }}
    >
      <Stack gap={4}>
        {#if manager.profile}
          <Alert color="success" class="self-start">
            Signed in as {manager.profile.name} ({manager.profile.account}). The token and user ID
            have been saved.
          </Alert>
          <Button variant="filled" fullWidth onclick={() => onClose()}>Done</Button>
        {:else}
          {#if manager.error}
            <Alert color="danger" class="self-start">{manager.error}</Alert>
          {/if}

          <Field label="Email" required="indicator">
            <Input
              type="email"
              autocomplete="username"
              bind:value={manager.account}
              placeholder="accounts@example.com"
            />
          </Field>

          <Field label="Password" required="indicator">
            <PasswordInput
              autocomplete="current-password"
              bind:value={manager.password}
              placeholder="Bambu Lab password"
            />
          </Field>

          <Field
            label="Authenticator Code"
            required="indicator"
            description="The 6-digit code from your authenticator app"
          >
            <Input
              inputmode="numeric"
              autocomplete="one-time-code"
              maxlength={6}
              bind:value={manager.tfaCode}
              placeholder="123456"
            />
          </Field>

          <Button type="submit" variant="filled" fullWidth disabled={!manager.canSubmit}>
            {manager.isSubmitting ? 'Signing in…' : 'Sign In'}
          </Button>
        {/if}
      </Stack>
    </form>
  </ModalBody>
</Modal>
