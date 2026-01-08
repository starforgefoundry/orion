<script lang="ts">
  import TextInput from '$lib/frontend/components/form/TextInput.svelte';
  import type { ModalProps } from '$lib/frontend/components/utils';
  import { createOrganizationForm } from '$lib/remotes/endpoints/organization.remote';
  import { Button, Field, Modal, ModalBody, Stack } from '@immich/ui';
  import { mdiAccountGroup } from '@mdi/js';

  let { onClose }: ModalProps = $props();
</script>

<Modal title="Create Organization" icon={mdiAccountGroup} {onClose}>
  <ModalBody>
    <form {...createOrganizationForm} onsubmit={() => onClose()}>
      <Stack gap={4}>
        <Field label="Organization Name" required="indicator">
          <TextInput
            {...createOrganizationForm.fields.name.as('text')}
            placeholder="e.g., Engineering Club"
          />
        </Field>
        <Field label="Email" required="indicator">
          <TextInput
            {...createOrganizationForm.fields.email.as('email')}
            placeholder="e.g., club@example.com"
          />
        </Field>
        <Button type="submit" variant="filled" fullWidth>Create Organization</Button>
      </Stack>
    </form>
  </ModalBody>
</Modal>
