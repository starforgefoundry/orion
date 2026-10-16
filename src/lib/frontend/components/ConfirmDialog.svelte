<script lang="ts">
  import * as AlertDialog from '$lib/components/ui/alert-dialog';
  import type { ConfirmOptions } from '$lib/frontend/modal-manager.svelte';

  type Props = ConfirmOptions & { onClose: (confirmed?: boolean) => void };

  let {
    title,
    prompt,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'default',
    hideCancel = false,
    onClose,
  }: Props = $props();
</script>

<AlertDialog.Root open onOpenChange={(open) => !open && onClose(false)}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>{title}</AlertDialog.Title>
      <AlertDialog.Description>{prompt}</AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      {#if !hideCancel}
        <AlertDialog.Cancel onclick={() => onClose(false)}>{cancelText}</AlertDialog.Cancel>
      {/if}
      <AlertDialog.Action {variant} onclick={() => onClose(true)}>{confirmText}</AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
