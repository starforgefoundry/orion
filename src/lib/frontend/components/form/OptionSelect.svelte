<script lang="ts" module>
  export type SelectOption = { value: string; label: string };
</script>

<script lang="ts">
  import * as Select from '$lib/components/ui/select';
  import type { Snippet } from 'svelte';

  type Props = {
    options: SelectOption[];
    value: string;
    placeholder?: string;
    /** Adds a first option that maps back to an empty value, which the underlying select can't represent. */
    noneLabel?: string;
    disabled?: boolean;
    id?: string;
    class?: string;
    onValueChange?: (value: string) => void;
    /** Renders an option in the list and, when selected, in the trigger. */
    item?: Snippet<[SelectOption]>;
  };

  const NONE_VALUE = '__none__';

  let {
    options,
    value = $bindable(),
    placeholder = 'Select…',
    noneLabel,
    disabled = false,
    id,
    class: className = 'w-full',
    onValueChange,
    item,
  }: Props = $props();

  const allOptions = $derived(
    noneLabel ? [{ value: NONE_VALUE, label: noneLabel }, ...options] : options,
  );
  const selectValue = $derived(noneLabel && value === '' ? NONE_VALUE : value);
  const selected = $derived(allOptions.find((option) => option.value === selectValue));

  function handleChange(next: string) {
    value = next === NONE_VALUE ? '' : next;
    onValueChange?.(value);
  }
</script>

<Select.Root type="single" value={selectValue} onValueChange={handleChange} {disabled}>
  <Select.Trigger {id} class={className}>
    {#if selected && item && selected.value !== NONE_VALUE}
      <span class="flex min-w-0 items-center gap-2">{@render item(selected)}</span>
    {:else}
      <span class={selected ? 'truncate' : 'truncate text-muted-foreground'}>
        {selected?.label ?? placeholder}
      </span>
    {/if}
  </Select.Trigger>
  <Select.Content>
    {#each allOptions as option (option.value)}
      <Select.Item value={option.value} label={option.label}>
        {#if item && option.value !== NONE_VALUE}
          {@render item(option)}
        {:else}
          {option.label}
        {/if}
      </Select.Item>
    {/each}
  </Select.Content>
</Select.Root>
