<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { Label } from '$lib/components/ui/label';
  import Modal from '$lib/frontend/components/Modal.svelte';
  import type { ModalProps } from '$lib/frontend/components/utils';
  import BanIcon from '@lucide/svelte/icons/ban';

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

<Modal title="Cancel Class" icon={BanIcon} {onClose} size="sm">
  <div class="flex flex-col gap-3 text-sm">
    <p>Cancel this class? All bookings will be refunded.</p>

    {#if hasRecurrenceGroup}
      <Label class="flex cursor-pointer items-center gap-2 font-normal">
        <Checkbox bind:checked={cancelFuture} />
        Also cancel all future classes in this series
      </Label>
    {/if}
  </div>

  {#snippet footer()}
    <Button variant="outline" onclick={() => onClose()}>Go Back</Button>
    <Button variant="destructive" onclick={handleConfirm}>
      {cancelFuture ? 'Cancel All Future' : 'Cancel Class'}
    </Button>
  {/snippet}
</Modal>
