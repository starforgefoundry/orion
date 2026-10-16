<script lang="ts" generics="S extends string">
  import { cn } from '$lib/frontend/cn';

  interface Props {
    steps: { id: S; label: string }[];
    current: S;
  }

  let { steps, current }: Props = $props();
</script>

<ol class="flex items-center gap-3 text-sm" aria-label="Form steps">
  {#each steps as step, index (step.id)}
    {@const isActive = current === step.id}
    {#if index > 0}<li aria-hidden="true" class="h-px w-8 bg-border"></li>{/if}
    <li
      class={cn('flex items-center gap-2', isActive ? 'font-medium' : 'text-muted-foreground')}
      aria-current={isActive ? 'step' : undefined}
    >
      <span
        class={cn(
          'grid size-6 place-items-center rounded-full border text-xs',
          isActive && 'border-primary bg-primary text-primary-foreground',
        )}
      >
        {index + 1}
      </span>
      {step.label}
    </li>
  {/each}
</ol>
