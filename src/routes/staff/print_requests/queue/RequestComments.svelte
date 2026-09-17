<script lang="ts">
  import TextArea from '$lib/frontend/components/form/TextArea.svelte';
  import { initForm } from '$lib/frontend/components/form/utils.svelte';
  import { MAX_COMMENT_ATTACHMENTS } from '$lib/remotes/dtos/print_request.dto';
  import {
    addPrintRequestCommentForm,
    getPrintRequestComments,
  } from '$lib/remotes/endpoints/print_request.remote';
  import { getPrintRequestSettings } from '$lib/remotes/endpoints/settings.remote';
  import { Button, Heading, HStack, Icon, IconButton, Stack, Text, toastManager } from '@immich/ui';
  import { mdiClose, mdiDownload, mdiMonitorShare, mdiPaperclip, mdiSend } from '@mdi/js';
  import { DateTime } from 'luxon';

  type Props = {
    requestId: string;
  };

  const { requestId }: Props = $props();

  let attachmentInput = $state<HTMLInputElement>();
  let attachments = $state<File[]>([]);

  $effect(() => {
    addPrintRequestCommentForm.fields.attachments.set(attachments);
  });

  const comments = $derived(getPrintRequestComments(requestId).current ?? []);
  const settings = $derived(getPrintRequestSettings().current);

  const slicerExtensions = $derived(
    (settings?.allowedFileTypes ?? '')
      .split(',')
      .map((ext) => ext.trim().replace(/^\./, '').toLowerCase())
      .filter(Boolean),
  );

  initForm(addPrintRequestCommentForm, () => ({ printRequestId: requestId, body: '' }));

  const canPost = $derived(addPrintRequestCommentForm.fields.body.value().trim().length > 0);

  function initials(name: string) {
    return name
      .split(' ')
      .map((part) => part.at(0) ?? '')
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  function opensInSlicer(fileName: string) {
    const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
    return slicerExtensions.includes(extension);
  }

  function slicerUrl(fileUrl: string) {
    return `orcaslicer://open?file=${encodeURIComponent(fileUrl)}`;
  }

  function addAttachments() {
    const picked = Array.from(attachmentInput?.files ?? []);
    const room = MAX_COMMENT_ATTACHMENTS - attachments.length;

    if (picked.length > room) {
      toastManager.warning(`You can attach up to ${MAX_COMMENT_ATTACHMENTS} files per comment.`);
    }

    attachments = [...attachments, ...picked.slice(0, room)];
  }

  function removeAttachment(index: number) {
    attachments = attachments.filter((_, position) => position !== index);
  }

  type SubmitParameters = Parameters<Parameters<typeof addPrintRequestCommentForm.enhance>[0]>[0];
  async function postComment({ submit }: SubmitParameters) {
    await submit();

    if (addPrintRequestCommentForm.fields.allIssues()) {
      return;
    }

    addPrintRequestCommentForm.fields.body.set('');
    attachments = [];
  }
</script>

{#snippet attachmentRow(fileName: string, fileUrl?: string, onRemove?: () => void)}
  <HStack class="items-center justify-between rounded-lg border border-slate-700 p-2" gap={2}>
    <HStack gap={1} class="min-w-0 items-center">
      <Icon icon={mdiPaperclip} size="18" />
      <Text size="small" class="truncate">{fileName}</Text>
    </HStack>
    <HStack gap={1} class="shrink-0">
      {#if fileUrl}
        <IconButton
          icon={mdiDownload}
          aria-label="Download Attachment"
          color="primary"
          size="tiny"
          href={fileUrl}
          download={fileName}
        />
        {#if opensInSlicer(fileName)}
          <IconButton
            icon={mdiMonitorShare}
            aria-label="Send to OrcaSlicer"
            color="success"
            size="tiny"
            href={slicerUrl(fileUrl)}
          />
        {/if}
      {/if}
      {#if onRemove}
        <IconButton
          icon={mdiClose}
          aria-label="Remove Attachment"
          color="danger"
          variant="ghost"
          shape="round"
          size="tiny"
          onclick={onRemove}
        />
      {/if}
    </HStack>
  </HStack>
{/snippet}

<Stack class="min-h-0 flex-1 rounded-2xl border-2 border-slate-700 p-4">
  <Heading size="small">Comments</Heading>

  <!-- The list is taken out of flow so a long thread scrolls instead of stretching the modal. -->
  <div class="relative min-h-32 flex-1">
    <Stack gap={2} class="absolute inset-0 overflow-y-auto">
      {#each comments as comment (comment.id)}
        <div class="bg-level-2 rounded-lg border border-slate-600 p-3">
          <HStack class="items-center justify-between" gap={2}>
            <HStack gap={2} class="min-w-0 items-center">
              <div
                class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[0.6rem] font-medium text-light"
              >
                {initials(comment.authorName)}
              </div>
              <Text size="small" fontWeight="bold" class="truncate">{comment.authorName}</Text>
            </HStack>
            <Text size="tiny" color="muted" class="shrink-0">
              {comment.createdDate.toLocaleString(DateTime.DATETIME_MED)}
            </Text>
          </HStack>

          <Text size="small" class="mt-2 whitespace-pre-line">{comment.body}</Text>

          {#if comment.attachments.length > 0}
            <Stack gap={1} class="mt-3">
              {#each comment.attachments as attachment (attachment.id)}
                {@render attachmentRow(attachment.fileName, attachment.fileUrl)}
              {/each}
            </Stack>
          {/if}
        </div>
      {:else}
        <Text size="small" color="muted">No comments yet.</Text>
      {/each}
    </Stack>
  </div>

  <form {...addPrintRequestCommentForm.enhance(postComment)} enctype="multipart/form-data">
    <input
      {...addPrintRequestCommentForm.fields.printRequestId.as('text')}
      value={requestId}
      hidden
    />
    <input
      {...addPrintRequestCommentForm.fields.attachments.as('file multiple')}
      bind:this={attachmentInput}
      onchange={addAttachments}
      hidden
    />

    <Stack gap={2}>
      <div class="relative">
        <TextArea
          {...addPrintRequestCommentForm.fields.body.as('text')}
          placeholder="Add a note for the rest of the staff..."
          class="pr-12"
          rows={2}
        />
        <IconButton
          icon={mdiPaperclip}
          aria-label="Attach Files"
          color="secondary"
          variant="ghost"
          shape="round"
          size="small"
          class="absolute top-2 right-2"
          disabled={attachments.length >= MAX_COMMENT_ATTACHMENTS}
          onclick={() => attachmentInput?.click()}
        />
      </div>

      {#if attachments.length > 0}
        <Stack gap={1}>
          {#each attachments as attachment, index (`${attachment.name}-${index}`)}
            {@render attachmentRow(attachment.name, undefined, () => removeAttachment(index))}
          {/each}
        </Stack>
      {/if}

      <Button
        type="submit"
        leadingIcon={mdiSend}
        size="small"
        class="self-end"
        disabled={!canPost}
        loading={addPrintRequestCommentForm.pending > 0}
      >
        Post
      </Button>
    </Stack>
  </form>
</Stack>
