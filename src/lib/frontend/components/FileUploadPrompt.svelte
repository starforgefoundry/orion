<script lang="ts">
  import { cn } from '$lib/frontend/cn';
  import FilePlusIcon from '@lucide/svelte/icons/file-plus';

  type Props = {
    onclick: () => void;
    hint?: string;
    id?: string;
    invalid?: boolean;
    class?: string;
  };

  let { onclick, hint, id, invalid = false, class: className }: Props = $props();
</script>

<button
  {id}
  type="button"
  class={cn(
    'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors hover:border-primary/70 hover:bg-muted/30 focus-visible:border-ring focus-visible:outline-none',
    invalid && 'border-destructive',
    className,
  )}
  data-invalid={invalid || undefined}
  {onclick}
>
  <FilePlusIcon class="size-10 text-muted-foreground" />
  <span class="text-base">
    <span class="font-medium">Click to upload</span>
    <span class="text-muted-foreground">or drag and drop</span>
  </span>
  {#if hint}<span class="text-sm text-muted-foreground">{hint}</span>{/if}
</button>
