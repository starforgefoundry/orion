<script lang="ts">
  import type { PriceRow } from './tiers';

  interface Props {
    rows: PriceRow[];
  }

  let { rows }: Props = $props();
</script>

<div
  class="grid grid-cols-[auto_1fr_1fr] items-baseline gap-x-4 gap-y-1 rounded-lg bg-muted/60 p-3"
>
  <span></span>
  <span class="text-xs text-muted-foreground">Member</span>
  <span class="text-xs text-muted-foreground">Non-member</span>
  {#each rows as row (row.label ?? 'price')}
    <span class="text-xs text-muted-foreground">{row.label ?? ''}</span>
    <span class="text-lg font-semibold tabular-nums">{row.member}</span>
    <span class="text-lg font-semibold text-muted-foreground tabular-nums">{row.nonMember}</span>
  {/each}
</div>
