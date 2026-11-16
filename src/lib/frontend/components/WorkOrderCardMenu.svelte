<script lang="ts" module>
  import type { Component } from 'svelte';

  export type CardAction = { label: string; icon: Component; onSelect: () => void };
</script>

<script lang="ts">
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import IconButton from '$lib/frontend/components/IconButton.svelte';
  import EllipsisVerticalIcon from '@lucide/svelte/icons/ellipsis-vertical';

  let { actions }: { actions: CardAction[] } = $props();
</script>

<!-- Opening the menu must not also open the card it sits on. -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="-my-1 -mr-1"
  onclick={(e) => e.stopPropagation()}
  onkeydown={(e) => e.stopPropagation()}
>
  <DropdownMenu.Root>
    <DropdownMenu.Trigger>
      {#snippet child({ props })}
        <IconButton
          {...props}
          icon={EllipsisVerticalIcon}
          size="icon"
          aria-label="Request options"
          tooltip={false}
        />
      {/snippet}
    </DropdownMenu.Trigger>
    <DropdownMenu.Content align="end" class="w-56">
      {#each actions as action (action.label)}
        <DropdownMenu.Item onSelect={action.onSelect}>
          <action.icon />
          {action.label}
        </DropdownMenu.Item>
      {/each}
    </DropdownMenu.Content>
  </DropdownMenu.Root>
</div>
