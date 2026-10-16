<script lang="ts">
  import IconButton from '$lib/frontend/components/IconButton.svelte';
  import LinkIcon from '@lucide/svelte/icons/link';
  import type { Snippet } from 'svelte';

  type Props = {
    title: string;
    description?: string;
    /** The public page this dashboard manages, opened in a new tab. */
    formHref?: string;
    actions?: Snippet;
  };

  let { title, description, formHref, actions }: Props = $props();
</script>

<svelte:head>
  <title>{title} | Orion</title>
</svelte:head>

<div class="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
  <div class="min-w-0">
    <div class="flex items-center gap-1">
      <h1 class="truncate text-xl font-semibold tracking-tight">{title}</h1>
      {#if formHref}
        <IconButton
          icon={LinkIcon}
          aria-label="Open public form"
          href={formHref}
          target="_blank"
          class="text-muted-foreground"
        />
      {/if}
    </div>
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
