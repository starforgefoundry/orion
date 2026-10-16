<script lang="ts">
  import type { Snippet } from 'svelte';

  type Props = {
    title: string;
    description?: string;
    actions?: Snippet;
  };

  let { title, description, actions }: Props = $props();
</script>

<svelte:head>
  <title>{title} | Orion</title>
</svelte:head>

<div class="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
  <div class="min-w-0">
    <h1 class="truncate text-xl font-semibold tracking-tight">{title}</h1>
    {#if description}
      <p class="text-sm text-muted-foreground">{description}</p>
    {/if}
  </div>
  {#if actions}
    <div class="flex flex-wrap items-center gap-2">
      {@render actions()}
    </div>
  {/if}
</div>
