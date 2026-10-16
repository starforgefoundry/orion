<script lang="ts" module>
  export type Tone = 'neutral' | 'primary' | 'info' | 'success' | 'warning' | 'danger';

  const TONE_CLASSES: Record<Tone, string> = {
    neutral: 'bg-muted text-muted-foreground',
    primary: 'bg-primary/15 text-primary',
    info: 'bg-info/15 text-info',
    success: 'bg-success/15 text-success',
    warning: 'bg-warning/15 text-warning',
    danger: 'bg-destructive/15 text-destructive',
  };
</script>

<script lang="ts">
  import { Badge } from '$lib/components/ui/badge';
  import { cn } from '$lib/frontend/cn';
  import type { Snippet } from 'svelte';

  type Props = {
    tone?: Tone;
    class?: string;
    children: Snippet;
  };

  let { tone = 'neutral', class: className, children }: Props = $props();
</script>

<Badge variant="secondary" class={cn(TONE_CLASSES[tone], className)}>
  {@render children()}
</Badge>
