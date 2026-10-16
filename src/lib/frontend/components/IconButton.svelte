<script lang="ts">
  import { Button, type ButtonProps } from '$lib/components/ui/button';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { mergeProps } from 'bits-ui';
  import type { Component } from 'svelte';

  type Props = Omit<ButtonProps, 'children' | 'size'> & {
    icon: Component;
    'aria-label': string;
    size?: 'icon-xs' | 'icon-sm' | 'icon' | 'icon-lg';
    // Turn off for buttons that already open a popup (e.g. dropdown triggers); the two fight over hover state.
    tooltip?: boolean;
  };

  let {
    icon: Icon,
    variant = 'ghost',
    size = 'icon-sm',
    tooltip = true,
    ...props
  }: Props = $props();
</script>

{#if tooltip}
  <Tooltip.Root>
    <Tooltip.Trigger>
      {#snippet child({ props: triggerProps })}
        <!-- Merged so handlers from an outer trigger don't replace the tooltip's. -->
        <Button {...mergeProps(triggerProps, props)} {variant} {size}>
          <Icon />
        </Button>
      {/snippet}
    </Tooltip.Trigger>
    <Tooltip.Content>{props['aria-label']}</Tooltip.Content>
  </Tooltip.Root>
{:else}
  <Button {...props} {variant} {size}>
    <Icon />
  </Button>
{/if}
