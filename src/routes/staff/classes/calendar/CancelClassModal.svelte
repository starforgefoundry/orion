<script lang="ts">
  import type { ModalProps } from '$lib/frontend/components/utils';
  import { Button, Modal, ModalBody, Stack, Text } from '@immich/ui';
  import { mdiCancel } from '@mdi/js';

  interface Props extends ModalProps {
    hasRecurrenceGroup: boolean;
    onConfirm: (mode: 'single' | 'this_and_future') => void;
  }

  let { onClose, hasRecurrenceGroup, onConfirm }: Props = $props();

  let cancelFuture = $state(false);

  function handleConfirm() {
    onConfirm(cancelFuture ? 'this_and_future' : 'single');
    onClose();
  }
</script>

<Modal title="Cancel Class" icon={mdiCancel} {onClose} size="small">
  <ModalBody>
    <Stack gap={4}>
      <Text>Cancel this class? All bookings will be refunded.</Text>

      {#if hasRecurrenceGroup}
        <label class="flex cursor-pointer items-center gap-3">
          <input type="checkbox" bind:checked={cancelFuture} class="h-4 w-4 rounded" />
          <Text>Also cancel all future classes in this series</Text>
        </label>
      {/if}

      <div class="flex gap-2">
        <Button variant="outline" onclick={onClose} fullWidth>
          Go Back
        </Button>
        <Button color="danger" onclick={handleConfirm} fullWidth>
          {cancelFuture ? 'Cancel All Future' : 'Cancel Class'}
        </Button>
      </div>
    </Stack>
  </ModalBody>
</Modal>
