<script lang="ts">
  import { cn } from '$lib/frontend/cn';
  import UploadIcon from '@lucide/svelte/icons/upload';
  import type { Snippet } from 'svelte';

  type Props = {
    onUpload: (file: File) => void;
    onUnsupported: (file: File) => void;
    supportedExtensions?: string[];
    class?: string;
    children: Snippet<[{ open: () => void }]>;
  };

  let {
    onUpload,
    onUnsupported,
    supportedExtensions,
    class: className,
    children,
  }: Props = $props();

  let isDragging = $state(false);
  let fileInput = $state<HTMLInputElement>();

  const accept = $derived(supportedExtensions?.map((ext) => `.${ext}`).join(','));

  function isSupported(file: File) {
    if (!supportedExtensions) return true;
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    return supportedExtensions.includes(extension);
  }

  function addFiles(files: Iterable<File>) {
    for (const file of files) {
      if (isSupported(file)) onUpload(file);
      else onUnsupported(file);
    }
  }

  function hasFiles(event: DragEvent) {
    return event.dataTransfer?.types.includes('Files') ?? false;
  }

  function handleDragOver(event: DragEvent) {
    if (!hasFiles(event)) return;
    event.preventDefault();
    isDragging = true;
  }

  function handleDragLeave(event: DragEvent) {
    const target = event.currentTarget as HTMLElement;
    if (target.contains(event.relatedTarget as Node | null)) return;
    isDragging = false;
  }

  function handleDrop(event: DragEvent) {
    if (!hasFiles(event)) return;
    event.preventDefault();
    isDragging = false;
    addFiles(event.dataTransfer?.files ?? []);
  }

  function handlePick() {
    addFiles(fileInput?.files ?? []);
    if (fileInput) fileInput.value = '';
  }
</script>

<div
  role="region"
  aria-label="File drop area"
  class={cn('relative', className)}
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
>
  <input bind:this={fileInput} type="file" {accept} onchange={handlePick} class="hidden" multiple />

  {@render children({ open: () => fileInput?.click() })}

  <div
    class={cn(
      'pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-[inherit] border-2 border-dashed border-primary bg-background/90 text-sm font-medium text-primary transition-opacity',
      isDragging ? 'opacity-100' : 'opacity-0',
    )}
  >
    <UploadIcon class="size-6" />
    Drop files to add them
  </div>
</div>
