<script lang="ts" module>
  import type { Component } from 'svelte';
  import type { Tone } from './StatusBadge.svelte';

  export type StatusDisplay = {
    label: string;
    tone: Tone;
    icon: Component;
  };

  export type StatusIndicatorSize = 'default' | 'lg';

  const SIZE_CLASSES: Record<StatusIndicatorSize, string> = {
    default: '',
    lg: 'h-7 gap-1.5 px-3 text-sm [&>svg]:size-4!',
  };
</script>

<script lang="ts">
  import { cn } from '$lib/frontend/cn';
  import StatusBadge from './StatusBadge.svelte';

  type Props = {
    display: StatusDisplay;
    iconOnly?: boolean;
    size?: StatusIndicatorSize;
    class?: string;
  };

  let { display, iconOnly = false, size = 'default', class: className }: Props = $props();
</script>

<StatusBadge
  tone={display.tone}
  class={cn(SIZE_CLASSES[size], iconOnly && 'size-5 px-0', className)}
>
  <display.icon />
  {#if iconOnly}
    <span class="sr-only">{display.label}</span>
  {:else}
    {display.label}
  {/if}
</StatusBadge>
