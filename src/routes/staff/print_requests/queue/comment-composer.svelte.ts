import { uploadForm } from '$lib/frontend/upload-form';
import { MAX_COMMENT_ATTACHMENTS } from '$lib/remotes/dtos/print-request.dto';
import {
  addPrintRequestCommentForm,
  getPrintRequestComments,
} from '$lib/remotes/endpoints/print-request.remote';
import { SvelteMap } from 'svelte/reactivity';
import { toast } from 'svelte-sonner';

/** Upload percent per request, shared so a reopened composer sees an upload already running. */
const uploads = new SvelteMap<string, number>();

export class CommentComposer {
  attachments = $state<File[]>([]);
  isDragging = $state(false);
  input = $state<HTMLInputElement>();

  #requestId: () => string;

  constructor(requestId: () => string) {
    this.#requestId = requestId;
  }

  get submitting() {
    return uploads.has(this.#requestId());
  }

  get progress() {
    return uploads.get(this.#requestId()) ?? 0;
  }

  get canAttach() {
    return !this.submitting && this.attachments.length < MAX_COMMENT_ATTACHMENTS;
  }

  get canPost() {
    const hasBody = addPrintRequestCommentForm.fields.body.value().trim().length > 0;
    return !this.submitting && (hasBody || this.attachments.length > 0);
  }

  async submit(form: HTMLFormElement) {
    if (!this.canPost) return;

    const requestId = this.#requestId();
    uploads.set(requestId, 0);

    try {
      await uploadForm(
        { method: form.method, action: form.action, body: new FormData(form) },
        (percent) => uploads.set(requestId, percent),
      );
    } catch {
      toast.error('Failed to post comment. Please try again.');
      return;
    } finally {
      uploads.delete(requestId);
    }

    // The form is shared across requests, so leave the draft alone if another request is open now.
    if (addPrintRequestCommentForm.fields.printRequestId.value() === requestId) {
      addPrintRequestCommentForm.fields.body.set('');
    }
    this.reset();

    try {
      await getPrintRequestComments(requestId).refresh();
    } catch {
      toast.warning('Comment posted, but the comment list failed to reload.');
    }
  }

  addFiles(files: Iterable<File>) {
    if (this.submitting) return;

    const picked = Array.from(files);
    const room = MAX_COMMENT_ATTACHMENTS - this.attachments.length;

    if (picked.length > room) {
      toast.warning(`You can attach up to ${MAX_COMMENT_ATTACHMENTS} files per comment.`);
    }

    this.#setAttachments([...this.attachments, ...picked.slice(0, Math.max(room, 0))]);
  }

  removeAttachment(index: number) {
    this.#setAttachments(this.attachments.filter((_, position) => position !== index));
  }

  reset() {
    this.#setAttachments([]);
  }

  openPicker() {
    this.input?.click();
  }

  handlePickerChange() {
    // The picker replaces the input's FileList, so read the pick before restoring the full list.
    const picked = Array.from(this.input?.files ?? []);
    this.#syncInput();
    this.addFiles(picked);
  }

  // File drags are always intercepted, even while locked, so the browser never opens the file.
  handleDragEnter(event: DragEvent) {
    if (!hasFiles(event)) return;
    event.preventDefault();
    this.isDragging = !this.submitting;
  }

  handleDragOver(event: DragEvent) {
    if (!hasFiles(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = this.submitting ? 'none' : 'copy';
  }

  handleDragLeave(event: DragEvent) {
    const target = event.currentTarget as HTMLElement;
    if (target.contains(event.relatedTarget as Node | null)) return;
    this.isDragging = false;
  }

  handleDrop(event: DragEvent) {
    if (!hasFiles(event)) return;
    event.preventDefault();
    this.isDragging = false;
    this.addFiles(event.dataTransfer?.files ?? []);
  }

  #setAttachments(files: File[]) {
    this.attachments = files;
    this.#syncInput();
  }

  #syncInput() {
    if (!this.input) return;
    const transfer = new DataTransfer();
    for (const file of this.attachments) transfer.items.add(file);
    this.input.files = transfer.files;
  }
}

function hasFiles(event: DragEvent) {
  return event.dataTransfer?.types.includes('Files') ?? false;
}
