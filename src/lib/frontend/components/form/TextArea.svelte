<script lang="ts">
  import { Textarea } from '$lib/components/ui/textarea';
  import type { HTMLTextareaAttributes } from 'svelte/elements';

  type Props = Omit<HTMLTextareaAttributes, 'value'> & {
    value?: string | number | null;
  };

  let { value = $bindable(), ...props }: Props = $props();
</script>

<Textarea bind:value {...props} />
