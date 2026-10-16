<script lang="ts">
  import FilePlusIcon from '@lucide/svelte/icons/file-plus';
  import FileDropArea from './FileDropArea.svelte';

  type Props = {
    onUpload: (file: File) => void;
    onUnsupported: (file: File) => void;
    supportedExtensions?: string[];
  };

  let { onUpload, onUnsupported, supportedExtensions }: Props = $props();
</script>

<FileDropArea {onUpload} {onUnsupported} {supportedExtensions} class="w-full rounded-lg">
  {#snippet children({ open })}
    <button
      type="button"
      class="flex w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors hover:border-primary/70 focus-visible:border-ring focus-visible:outline-none"
      onclick={open}
    >
      <FilePlusIcon class="mb-1 size-8 text-muted-foreground" />
      <span class="text-sm">
        <span class="font-medium">Click to upload</span>
        <span class="text-muted-foreground">or drag and drop</span>
      </span>
      <span class="text-xs text-muted-foreground">
        Supported file types: {supportedExtensions ? supportedExtensions.join(', ') : 'All files'}
      </span>
    </button>
  {/snippet}
</FileDropArea>
