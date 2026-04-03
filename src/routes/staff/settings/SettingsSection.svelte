<script lang="ts">
  import { Card, CardBody, Heading, IconButton } from '@immich/ui';
  import { mdiChevronDown, mdiChevronRight } from '@mdi/js';
  import type { Snippet } from 'svelte';

  interface Props {
    title: string;
    children: Snippet;
    headerActions?: Snippet;
  }

  let { title, children, headerActions }: Props = $props();

  let open = $state(false);
</script>

<Card class=" max-w-3xl">
  <CardBody>
    <div class="flex w-full items-center justify-between">
      <button class="flex items-center gap-2 text-left" onclick={() => (open = !open)}>
        <IconButton
          icon={open ? mdiChevronDown : mdiChevronRight}
          variant="ghost"
          color="secondary"
          size="small"
          aria-label={open ? 'Collapse' : 'Expand'}
          onclick={(e: MouseEvent) => {
            e.stopPropagation();
            open = !open;
          }}
        />
        <Heading size="medium">{title}</Heading>
      </button>

      {#if open && headerActions}
        {@render headerActions()}
      {/if}
    </div>

    {#if open}
      <div class="mt-4">
        {@render children()}
      </div>
    {/if}
  </CardBody>
</Card>
