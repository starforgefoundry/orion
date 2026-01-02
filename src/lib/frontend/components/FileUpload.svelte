<script lang="ts">
  import { Icon, Text } from '@immich/ui';
  import { mdiFilePlus } from '@mdi/js';

  type Props = {
    onUpload: (file: File) => void;
    onUnsupported: (file: File) => void;
    supportedExtensions?: string[];
  };

  let { onUpload, onUnsupported, supportedExtensions }: Props = $props();

  let isDragging = $state(false);
  let fileInput: HTMLInputElement;

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    isDragging = true;
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    isDragging = false;
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDragging = false;

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      for (const file of files) {
        const extension = file.name.split('.').pop()?.toLowerCase();
        if (supportedExtensions?.includes(extension || '')) {
          onUpload(file);
        } else {
          onUnsupported(file);
        }
      }
    }
  }

  function handleFileSelect(e: Event) {
    const target = e.target as HTMLInputElement;
    const files = target.files;
    if (files && files.length > 0) {
      for (const file of files) {
        const extension = file.name.split('.').pop()?.toLowerCase();
        if (supportedExtensions?.includes(extension || '')) {
          onUpload(file);
        } else {
          onUnsupported(file);
        }
      }
    }
  }

  function handleClick() {
    fileInput.click();
  }
</script>

<div class="w-full">
  <input
    bind:this={fileInput}
    type="file"
    accept={supportedExtensions ? supportedExtensions.map((ext) => `.${ext}`).join(',') : '*/*'}
    onchange={handleFileSelect}
    class="hidden"
    multiple
  />

  <div
    role="button"
    tabindex="0"
    class="relative flex h-36 w-full cursor-pointer items-center justify-center rounded-lg border-2 border-dashed transition-colors {isDragging
      ? 'border-primary bg-primary/10'
      : 'border-gray-300 hover:border-primary/70'}"
    ondragover={handleDragOver}
    ondragleave={handleDragLeave}
    ondrop={handleDrop}
    onclick={handleClick}
    onkeydown={(e) => e.key === 'Enter' && handleClick()}
  >
    <div class="flex flex-col justify-center text-center">
      <Icon icon={mdiFilePlus} size="48" class="mb-2 w-full text-gray-400" />
      <Text color="secondary" class="mb-1">
        <span class="font-semibold">Click to upload</span>
        or drag and drop
      </Text>
      <Text color="secondary" class="text-xs"
        >Supported file types: {supportedExtensions
          ? supportedExtensions.join(', ')
          : 'All files'}</Text
      >
    </div>
  </div>
</div>
