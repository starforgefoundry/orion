<script lang="ts">
  import * as Field from '$lib/components/ui/field';
  import { cn } from '$lib/frontend/cn';
  import type { Snippet } from 'svelte';

  type Props = {
    label: string;
    for?: string;
    required?: boolean;
    description?: string;
    error?: string;
    class?: string;
    children: Snippet;
  };

  let {
    label,
    for: htmlFor,
    required = false,
    description,
    error,
    class: className,
    children,
  }: Props = $props();
</script>

<Field.Field class={cn('gap-1.5', className)} data-invalid={error ? true : undefined}>
  <Field.Label for={htmlFor}>
    {label}
    {#if required}<span class="text-destructive">*</span>{/if}
  </Field.Label>
  {@render children()}
  {#if description}
    <Field.Description>{description}</Field.Description>
  {/if}
  {#if error}
    <Field.Error>{error}</Field.Error>
  {/if}
</Field.Field>
