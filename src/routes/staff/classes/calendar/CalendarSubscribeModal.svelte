<script lang="ts">
  import { page } from '$app/state';
  import type { ModalProps } from '$lib/frontend/components/utils';
  import { getMyIcalToken } from '$lib/remotes/endpoints/class.remote';
  import { Button, LoadingSpinner, Modal, ModalBody, Stack, Text } from '@immich/ui';
  import { mdiCalendarSync, mdiContentCopy } from '@mdi/js';

  let { onClose }: ModalProps = $props();

  const tokenRemote = getMyIcalToken();
  const icalToken = $derived(tokenRemote.current);

  const feedUrl = $derived(`${page.url.origin}/api/classes/ical/${icalToken}`);
  const webcalUrl = $derived(feedUrl.replace(/^https?:/, 'webcal:'));
  const googleUrl = $derived(
    `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl)}`,
  );

  let copied = $state(false);

  async function copyUrl() {
    await navigator.clipboard.writeText(feedUrl);
    copied = true;
    setTimeout(() => (copied = false), 2000);
  }
</script>

<Modal title="Subscribe to Calendar" icon={mdiCalendarSync} {onClose} size="small">
  <ModalBody>
    {#if tokenRemote.loading}
      <LoadingSpinner class="mx-auto" size="large" />
    {:else if !icalToken}
      <Text color="danger">Could not load calendar token.</Text>
    {:else}
      <Stack gap={4}>
        <Text color="muted" size="small">
          Subscribe to see your assigned classes in your calendar app. The calendar updates
          automatically as classes are added or changed.
        </Text>

        <Stack gap={2}>
          <a href={googleUrl} target="_blank" rel="noopener noreferrer">
            <Button fullWidth variant="outline">Google Calendar</Button>
          </a>
          <a href={webcalUrl}>
            <Button fullWidth variant="outline">Apple Calendar</Button>
          </a>
        </Stack>

        <div class="border-t border-gray-700 pt-4">
          <Text color="muted" size="small" class="mb-2">Or copy the feed URL:</Text>
          <div class="flex gap-2">
            <div
              class="flex-1 overflow-hidden rounded border border-gray-700 px-3 py-2 text-xs text-ellipsis whitespace-nowrap text-gray-400"
            >
              {feedUrl}
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
