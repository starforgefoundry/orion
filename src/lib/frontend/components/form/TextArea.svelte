<script lang="ts">
  import { Textarea } from '$lib/components/ui/textarea';
  import type { HTMLTextareaAttributes } from 'svelte/elements';
  import { formFieldContext } from './FormField.svelte';

  type Props = Omit<HTMLTextareaAttributes, 'value'> & {
    value?: string | number | null;
  };

  let { value = $bindable(), ...props }: Props = $props();

  const field = formFieldContext();
</script>

<Textarea bind:value {...props} aria-required={props['aria-required'] ?? field.required()} />
