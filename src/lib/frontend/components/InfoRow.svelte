<script lang="ts">
  import type { Snippet } from 'svelte';

  type Props = {
    label: string;
    children: Snippet;
  };

  let { label, children }: Props = $props();
</script>

<div class="flex min-h-7 items-center justify-between gap-4 text-sm">
  <dt class="shrink-0 text-muted-foreground">{label}</dt>
  <dd class="min-w-0 truncate text-right font-medium">{@render children()}</dd>
</div>
