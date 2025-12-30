<script lang="ts">
  import { currentUser } from '$lib/auth/user.svelte';
  import type { ModalProps } from '$lib/components/utils';
  import { signOut } from '@auth/sveltekit/client';
  import { Button, Modal, ModalBody } from '@immich/ui';

  let { onClose }: ModalProps = $props();
  let user = currentUser();
</script>

<Modal title={user?.name} {onClose} icon={false} size="small">
  <ModalBody>
    <div>Email: {user?.email}</div>

    <Button fullWidth color="danger" class="mt-4" onclick={() => signOut()}>Sign Out</Button>
  </ModalBody>
</Modal>
