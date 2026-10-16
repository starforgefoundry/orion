<script lang="ts" generics="T extends string">
  import { cn } from '$lib/frontend/cn';
  import CheckIcon from '@lucide/svelte/icons/check';

  type Props = {
    steps: { id: T; label: string }[];
    current: T;
    /** Steps before the current one show as done. */
    showCompleted?: boolean;
  };

  let { steps, current, showCompleted = false }: Props = $props();

  const currentIndex = $derived(steps.findIndex((step) => step.id === current));
</script>

<ol class="flex flex-wrap items-center gap-3 text-sm" aria-label="Steps">
  {#each steps as step, index (step.id)}
    {@const isActive = index === currentIndex}
    {@const isDone = showCompleted && index < currentIndex}
    {#if index > 0}<li aria-hidden="true" class="h-px w-8 bg-border"></li>{/if}
    <li
      class={cn('flex items-center gap-2', isActive ? 'font-medium' : 'text-muted-foreground')}
      aria-current={isActive ? 'step' : undefined}
    >
      <span
        class={cn(
          'grid size-6 place-items-center rounded-full border text-xs',
          isActive && 'border-primary bg-primary text-primary-foreground',
          isDone && 'border-success bg-success text-success-foreground',
        )}
      >
        {#if isDone}<CheckIcon class="size-3.5" />{:else}{index + 1}{/if}
      </span>
      {step.label}
    </li>
  {/each}
</ol>
