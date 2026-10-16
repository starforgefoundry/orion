<script lang="ts">
  import { cn } from '$lib/frontend/cn';
  import type { Snippet } from 'svelte';

  type Props = {
    title?: string;
    class?: string;
    actions?: Snippet;
    children: Snippet;
  };

  let { title, class: className, actions, children }: Props = $props();
</script>

<section class={cn('rounded-lg border', className)}>
  {#if title || actions}
    <header class="flex min-h-10 items-center justify-between gap-2 border-b py-1 pr-1 pl-3">
      <h3 class="truncate text-sm font-medium">{title}</h3>
      {#if actions}
        <div class="flex items-center gap-0.5">{@render actions()}</div>
      {/if}
    </header>
  {/if}
  <div class="p-3">
    {@render children()}
  </div>
</section>
