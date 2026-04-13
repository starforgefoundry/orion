<script lang="ts">
  import type { ModalProps } from '$lib/frontend/components/utils';
  import { getMyCalendarLink } from '$lib/remotes/endpoints/class.remote';
  import { Button, LoadingSpinner, Modal, ModalBody, Stack, Text } from '@immich/ui';
  import { mdiCalendarSync, mdiContentCopy, mdiGoogle } from '@mdi/js';

  let { onClose }: ModalProps = $props();

  const linkRemote = getMyCalendarLink();
  const calendarUrl = $derived(linkRemote.current);

  let copied = $state(false);

  async function copyUrl() {
    if (!calendarUrl) return;
    await navigator.clipboard.writeText(calendarUrl);
    copied = true;
    setTimeout(() => (copied = false), 2000);
  }
</script>

<Modal title="Add to Google Calendar" icon={mdiCalendarSync} {onClose} size="small">
  <ModalBody>
    {#if linkRemote.loading}
      <LoadingSpinner class="mx-auto" size="large" />
    {:else if !calendarUrl}
      <Text color="danger">
        Google Calendar isn't configured. Ask an administrator to set up the service account.
      </Text>
    {:else}
      <Stack gap={4}>
        <Text color="muted" size="small">
          Click the button below to add your Starforge class calendar to any Google account.
          Events update automatically as your class schedule changes—no manual refresh needed.
        </Text>

        <a href={calendarUrl} target="_blank" rel="noopener noreferrer">
          <Button fullWidth variant="outline" leadingIcon={mdiGoogle}>
            Add to Google Calendar
          </Button>
        </a>

        <div class="border-t border-gray-700 pt-4">
          <Text color="muted" size="small" class="mb-2">Or copy the invite link:</Text>
          <div class="flex gap-2">
            <div
              class="flex-1 overflow-hidden rounded border border-gray-700 px-3 py-2 text-xs text-ellipsis whitespace-nowrap text-gray-400"
            >
              {calendarUrl}
            </div>
            <Button size="small" variant="outline" leadingIcon={mdiContentCopy} onclick={copyUrl}>
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
        </div>
      </Stack>
    {/if}
  </ModalBody>
</Modal>
