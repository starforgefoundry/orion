<script lang="ts">
  import { Input } from '$lib/components/ui/input';
  import * as InputGroup from '$lib/components/ui/input-group';
  import type { Component } from 'svelte';
  import type { HTMLInputAttributes } from 'svelte/elements';

  type Props = Omit<HTMLInputAttributes, 'value' | 'type' | 'files'> & {
    value?: string | number | null;
    type?: 'text' | 'email' | 'number' | 'password' | 'search' | 'tel' | 'url' | 'date' | 'time';
    icon?: Component;
  };

  let { value = $bindable(), icon: Icon, class: className, ...props }: Props = $props();
</script>

{#if Icon}
  <InputGroup.Root class={className}>
    <InputGroup.Addon>
      <Icon />
    </InputGroup.Addon>
    <InputGroup.Input bind:value {...props} />
  </InputGroup.Root>
{:else}
  <Input bind:value class={className} {...props} />
{/if}
