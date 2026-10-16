<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import type { Snippet } from 'svelte';

  interface Props {
    title: string;
    description: string;
    formId?: string;
    actions?: Snippet;
    children: Snippet;
  }

  let { title, description, formId, actions, children }: Props = $props();
</script>

<section class="rounded-xl border bg-card">
  <header class="flex items-start justify-between gap-4 border-b p-4 sm:px-6">
    <div class="min-w-0">
      <h2 class="text-base font-semibold">{title}</h2>
      <p class="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
    {@render actions?.()}
  </header>

  <div class="p-4 sm:p-6">
    {@render children()}
  </div>

  {#if formId}
    <footer class="flex justify-end border-t bg-muted/30 px-4 py-3 sm:px-6">
      <Button type="submit" form={formId}>Save Changes</Button>
    </footer>
  {/if}
</section>
