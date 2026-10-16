<script lang="ts" module>
  import type { SortDirection } from '$lib/remotes/dtos/member.dto';

  export type ColumnSort = {
    direction: SortDirection | undefined;
    onSort: (direction: SortDirection) => void;
  };

  export type ColumnFilter<T extends string> = {
    options: { value: T; label: string }[];
    isSelected: (value: T) => boolean;
    onToggle: (value: T, checked: boolean) => void;
    onClear: () => void;
  };
</script>

<script lang="ts" generics="T extends string">
  import { Button } from '$lib/components/ui/button';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import { SORT_DIRECTION } from '$lib/remotes/dtos/member.dto';
  import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
  import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
  import ListFilterIcon from '@lucide/svelte/icons/list-filter';
  import XIcon from '@lucide/svelte/icons/x';

  type Props = {
    label: string;
    sort?: ColumnSort;
    filter?: ColumnFilter<T>;
  };

  let { label, sort, filter }: Props = $props();

  const filterCount = $derived(
    filter?.options.filter((option) => filter.isSelected(option.value)).length ?? 0,
  );
</script>

{#if !sort && !filter}
  {label}
{:else}
  <DropdownMenu.Root>
    <DropdownMenu.Trigger>
      {#snippet child({ props })}
        <Button {...props} variant="ghost" size="sm" class="-ml-2 h-8 px-2">
          {label}
          {#if sort?.direction === SORT_DIRECTION.ASC}
            <ArrowUpIcon />
          {:else if sort?.direction === SORT_DIRECTION.DESC}
            <ArrowDownIcon />
          {/if}
          {#if filterCount > 0}
            <span class="flex items-center gap-0.5 text-primary">
              <ListFilterIcon />{filterCount}
            </span>
          {:else if !sort?.direction}
            <ChevronDownIcon class="text-muted-foreground" />
          {/if}
        </Button>
      {/snippet}
    </DropdownMenu.Trigger>
    <DropdownMenu.Content align="start" class="w-48">
      {#if sort}
        <DropdownMenu.Item onSelect={() => sort.onSort(SORT_DIRECTION.ASC)}>
          <ArrowUpIcon />
          Sort ascending
        </DropdownMenu.Item>
        <DropdownMenu.Item onSelect={() => sort.onSort(SORT_DIRECTION.DESC)}>
          <ArrowDownIcon />
          Sort descending
        </DropdownMenu.Item>
      {/if}
      {#if sort && filter}
        <DropdownMenu.Separator />
      {/if}
      {#if filter}
        <DropdownMenu.Label class="text-xs text-muted-foreground">Filter</DropdownMenu.Label>
        {#each filter.options as option (option.value)}
          <DropdownMenu.CheckboxItem
            checked={filter.isSelected(option.value)}
            onCheckedChange={(checked) => filter.onToggle(option.value, checked)}
          >
            {option.label}
          </DropdownMenu.CheckboxItem>
        {/each}
        {#if filterCount > 0}
          <DropdownMenu.Separator />
          <DropdownMenu.Item onSelect={filter.onClear}>
            <XIcon />
            Clear filter
          </DropdownMenu.Item>
        {/if}
      {/if}
    </DropdownMenu.Content>
  </DropdownMenu.Root>
{/if}
