<script lang="ts">
  import { page } from '$app/state';
  import { Button } from '$lib/components/ui/button';
  import { Spinner } from '$lib/components/ui/spinner';
  import IconButton from '$lib/frontend/components/IconButton.svelte';
  import TextArea from '$lib/frontend/components/form/TextArea.svelte';
  import { initForm } from '$lib/frontend/components/form/utils.svelte';
  import { cn } from '$lib/frontend/cn';
  import {
    addPrintRequestCommentForm,
    getPrintRequestComments,
  } from '$lib/remotes/endpoints/print_request.remote';
  import { getPrintRequestSettings } from '$lib/remotes/endpoints/settings.remote';
  import DownloadIcon from '@lucide/svelte/icons/download';
  import MonitorUpIcon from '@lucide/svelte/icons/monitor-up';
  import PaperclipIcon from '@lucide/svelte/icons/paperclip';
  import SendIcon from '@lucide/svelte/icons/send';
  import UploadIcon from '@lucide/svelte/icons/upload';
  import XIcon from '@lucide/svelte/icons/x';
  import { DateTime } from 'luxon';
  import { CommentComposer } from './comment-composer.svelte';

  type Props = {
    requestId: string;
  };

  const { requestId }: Props = $props();

  const composer = new CommentComposer();

  $effect(() => {
    addPrintRequestCommentForm.fields.attachments.set(composer.attachments);
  });

  const comments = $derived([...(getPrintRequestComments(requestId).current ?? [])].reverse());
  const settings = $derived(getPrintRequestSettings().current);

  const slicerExtensions = $derived(
    (settings?.allowedFileTypes ?? '')
      .split(',')
      .map((ext) => ext.trim().replace(/^\./, '').toLowerCase())
      .filter(Boolean),
  );

  initForm(addPrintRequestCommentForm, () => ({ printRequestId: requestId, body: '' }));

  const canPost = $derived(
    addPrintRequestCommentForm.fields.body.value().trim().length > 0 ||
      composer.attachments.length > 0,
  );

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
    const absoluteUrl = new URL(fileUrl, page.url.origin).href;
    return `orcaslicer://open?file=${encodeURIComponent(absoluteUrl)}`;
  }

  type SubmitParameters = Parameters<Parameters<typeof addPrintRequestCommentForm.enhance>[0]>[0];
  async function postComment({ submit }: SubmitParameters) {
    await submit();

    if (addPrintRequestCommentForm.fields.allIssues()) {
      return;
    }

    addPrintRequestCommentForm.fields.body.set('');
    composer.reset();
  }
</script>

{#snippet attachmentRow(fileName: string, fileUrl?: string, onRemove?: () => void)}
  <div class="flex items-center gap-2 rounded-md border bg-background/50 py-1 pr-1 pl-2.5">
    <PaperclipIcon class="size-4 shrink-0 text-muted-foreground" />
    <span class="min-w-0 flex-1 truncate text-sm">{fileName}</span>
    {#if fileUrl}
      <IconButton
        icon={DownloadIcon}
        aria-label="Download"
        size="icon-sm"
        href={fileUrl}
        download={fileName}
      />
      {#if opensInSlicer(fileName)}
        <IconButton
          icon={MonitorUpIcon}
          aria-label="Open in OrcaSlicer"
          size="icon-sm"
          href={slicerUrl(fileUrl)}
          class="bg-success/15 text-success hover:bg-success/25 hover:text-success dark:hover:bg-success/25"
        />
      {/if}
    {/if}
    {#if onRemove}
      <IconButton icon={XIcon} aria-label="Remove attachment" size="icon-sm" onclick={onRemove} />
    {/if}
  </div>
{/snippet}

<section
  aria-label="Comments"
  class="relative flex min-h-0 flex-1 flex-col rounded-lg border"
  ondragenter={(e) => composer.handleDragEnter(e)}
  ondragover={(e) => composer.handleDragOver(e)}
  ondragleave={(e) => composer.handleDragLeave(e)}
  ondrop={(e) => composer.handleDrop(e)}
>
  <h3 class="border-b px-3 py-2 text-sm font-medium">Comments</h3>

  <div class="flex min-h-40 flex-1 flex-col gap-2 overflow-y-auto p-3 lg:min-h-0">
    {#each comments as comment (comment.id)}
      <article class="rounded-md bg-muted/50 p-2.5">
        <header class="flex items-center gap-2">
          <div
            class="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[0.55rem] font-medium text-primary-foreground"
          >
            {initials(comment.authorName)}
          </div>
          <span class="min-w-0 flex-1 truncate text-xs font-medium">{comment.authorName}</span>
          <time class="shrink-0 text-xs text-muted-foreground">
            {comment.createdDate.toLocaleString(DateTime.DATETIME_MED)}
          </time>
        </header>

        {#if comment.body}
          <p class="mt-1.5 text-sm whitespace-pre-line">{comment.body}</p>
        {/if}

        {#if comment.attachments.length > 0}
          <div class="mt-2 flex flex-col gap-1">
            {#each comment.attachments as attachment (attachment.id)}
              {@render attachmentRow(attachment.fileName, attachment.fileUrl)}
            {/each}
          </div>
        {/if}
      </article>
    {:else}
      <p class="text-sm text-muted-foreground">No comments yet.</p>
    {/each}
  </div>

  <form
    {...addPrintRequestCommentForm.enhance(postComment)}
    enctype="multipart/form-data"
    class="flex flex-col gap-2 border-t p-3"
  >
    <input
      {...addPrintRequestCommentForm.fields.printRequestId.as('text')}
      value={requestId}
      hidden
    />
    <input
      {...addPrintRequestCommentForm.fields.attachments.as('file multiple')}
      bind:this={composer.input}
      onchange={() => composer.handlePickerChange()}
      hidden
    />

    <TextArea
      {...addPrintRequestCommentForm.fields.body.as('text')}
      placeholder="Add a note for the rest of the staff…"
      class="min-h-14 resize-none"
      rows={2}
    />

    {#if composer.attachments.length > 0}
      <div class="flex flex-col gap-1">
        {#each composer.attachments as attachment, index (`${attachment.name}-${index}`)}
          {@render attachmentRow(attachment.name, undefined, () =>
            composer.removeAttachment(index),
          )}
        {/each}
      </div>
    {/if}

    <div class="flex items-center justify-between gap-2">
      <Button
        variant="ghost"
        size="sm"
        class="text-muted-foreground"
        disabled={!composer.canAttach}
        onclick={() => composer.openPicker()}
      >
        <PaperclipIcon />
        Attach or drop files
      </Button>
      <Button type="submit" size="sm" disabled={!canPost || addPrintRequestCommentForm.pending > 0}>
        {#if addPrintRequestCommentForm.pending > 0}<Spinner />{:else}<SendIcon />{/if}
        Post
      </Button>
    </div>
  </form>

  <div
    class={cn(
      'pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary bg-background/90 text-sm font-medium text-primary transition-opacity',
      composer.isDragging ? 'opacity-100' : 'opacity-0',
    )}
  >
    <UploadIcon class="size-6" />
    Drop files to attach
  </div>
</section>
