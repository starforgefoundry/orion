<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Spinner } from '$lib/components/ui/spinner';
  import Modal from '$lib/frontend/components/Modal.svelte';
  import type { ModalProps } from '$lib/frontend/components/utils';
  import { getMyCalendarLink } from '$lib/remotes/endpoints/class.remote';
  import CalendarSyncIcon from '@lucide/svelte/icons/calendar-sync';
  import CheckIcon from '@lucide/svelte/icons/check';
  import CopyIcon from '@lucide/svelte/icons/copy';
  import ExternalLinkIcon from '@lucide/svelte/icons/external-link';

  const COPIED_RESET_MS = 2000;

  let { onClose }: ModalProps = $props();

  const linkRemote = getMyCalendarLink();
  const calendarUrl = $derived(linkRemote.current);

  let copied = $state(false);

  async function copyUrl() {
    if (!calendarUrl) return;
    await navigator.clipboard.writeText(calendarUrl);
    copied = true;
    setTimeout(() => (copied = false), COPIED_RESET_MS);
  }
</script>

<Modal title="Add to Google Calendar" icon={CalendarSyncIcon} {onClose} size="sm">
  {#if linkRemote.loading}
    <div class="flex justify-center py-6">
      <Spinner class="size-6" />
    </div>
  {:else if !calendarUrl}
    <p class="text-sm text-destructive">
      Google Calendar isn't configured. Ask an administrator to set up the service account.
    </p>
  {:else}
    <div class="flex flex-col gap-3">
      <p class="text-sm text-muted-foreground">
        Add your Starforge class calendar to any Google account. Events update automatically as your
        class schedule changes.
      </p>

      <Button href={calendarUrl} target="_blank" rel="noopener noreferrer" variant="outline">
        <ExternalLinkIcon />
        Add to Google Calendar
      </Button>

      <div class="flex flex-col gap-1.5 border-t pt-3">
        <span class="text-xs text-muted-foreground">Or copy the invite link:</span>
        <div class="flex gap-2">
          <code
            class="min-w-0 flex-1 truncate rounded-md border bg-muted px-2 py-1.5 text-xs text-muted-foreground"
          >
            {calendarUrl}
          </code>
          <Button size="sm" variant="outline" onclick={copyUrl}>
            {#if copied}<CheckIcon />{:else}<CopyIcon />{/if}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
      </div>
    </div>
  {/if}
</Modal>
