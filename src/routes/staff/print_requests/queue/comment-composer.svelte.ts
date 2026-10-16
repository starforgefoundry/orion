import { MAX_COMMENT_ATTACHMENTS } from '$lib/remotes/dtos/print_request.dto';
import { toast } from 'svelte-sonner';

export class CommentComposer {
  attachments = $state<File[]>([]);
  isDragging = $state(false);
  input = $state<HTMLInputElement>();

  canAttach = $derived(this.attachments.length < MAX_COMMENT_ATTACHMENTS);

  addFiles(files: Iterable<File>) {
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

  handleDragEnter(event: DragEvent) {
    if (!hasFiles(event)) return;
    event.preventDefault();
    this.isDragging = true;
  }

  handleDragOver(event: DragEvent) {
    if (!hasFiles(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
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
