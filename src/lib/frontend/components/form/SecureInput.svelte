<script lang="ts">
  import * as InputGroup from '$lib/components/ui/input-group';
  import EyeIcon from '@lucide/svelte/icons/eye';
  import EyeOffIcon from '@lucide/svelte/icons/eye-off';
  import type { HTMLInputAttributes } from 'svelte/elements';

  type Props = Omit<HTMLInputAttributes, 'value' | 'type' | 'files'> & {
    value?: string | number | null;
  };

  let { value = $bindable(), class: className, ...props }: Props = $props();

  let revealed = $state(false);
</script>

<InputGroup.Root class={className}>
  <InputGroup.Input type={revealed ? 'text' : 'password'} bind:value {...props} />
  <InputGroup.Addon align="inline-end">
    <InputGroup.Button
      size="icon-xs"
      aria-label={revealed ? 'Hide value' : 'Show value'}
      onclick={() => (revealed = !revealed)}
    >
      {#if revealed}<EyeOffIcon />{:else}<EyeIcon />{/if}
    </InputGroup.Button>
  </InputGroup.Addon>
</InputGroup.Root>
