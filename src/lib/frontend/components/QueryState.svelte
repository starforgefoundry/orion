<script lang="ts" module>
  export type QueryLike<T> = { current: T | undefined; error?: unknown };
</script>

<script lang="ts" generics="T">
  import { Spinner } from '$lib/components/ui/spinner';
  import { errorDescription } from '$lib/frontend/form-submit';
  import type { Snippet } from 'svelte';

  type Props = {
    query: QueryLike<T>;
    /** What failed to load, as in "Error loading {label}". */
    label: string;
    children: Snippet<[Exclude<T, undefined>]>;
    pending?: Snippet;
  };

  let { query, label, children, pending }: Props = $props();

  const description = $derived(errorDescription(query.error));
</script>

{#if query.current !== undefined}
  {@render children(query.current as Exclude<T, undefined>)}
{:else if query.error}
  <p class="text-sm text-destructive">
    Error loading {label}{description ? `: ${description}` : '.'}
  </p>
{:else if pending}
  {@render pending()}
{:else}
  <div class="flex justify-center py-8">
    <Spinner class="size-6" />
  </div>
{/if}
