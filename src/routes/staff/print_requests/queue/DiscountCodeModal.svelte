<script lang="ts">
  import type { ModalProps } from '$lib/frontend/components/utils';
  import { Button, Field, Input, Modal, ModalBody, Stack, Text } from '@immich/ui';
  import { mdiTag } from '@mdi/js';

  type Props = ModalProps & {
    currentCode: string;
    onSave: (code: string) => void;
  };

  let { currentCode, onSave, onClose }: Props = $props();

  let code = $state(currentCode);
</script>

<Modal title="Edit Discount Code" icon={mdiTag} {onClose}>
  <ModalBody>
    <Stack gap={4}>
      <Text size="small" color="muted">
        Enter a billing/discount code for this print request. Leave empty to remove the code.
      </Text>
      <Field label="Discount Code">
        <Input bind:value={code} placeholder="e.g., ENGCLUB2024" />
      </Field>
      <Button
        variant="filled"
        fullWidth
        onclick={() => {
          onSave(code);
          onClose();
        }}
      >
        Save
      </Button>
    </Stack>
  </ModalBody>
</Modal>
