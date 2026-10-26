<script lang="ts">
  import { formatCents, type BillingDiscount, type BillingLineItem } from '$lib/utils/billing';

  type Props = {
    lineItems: BillingLineItem[];
    discounts: BillingDiscount[];
    total: number;
  };

  let { lineItems, discounts, total }: Props = $props();
</script>

<ul class="flex flex-col gap-2 text-sm">
  {#each lineItems as item, index (index)}
    <li class="flex items-start justify-between gap-4">
      <div class="min-w-0">
        <p>{item.name}</p>
        {#if item.description}
          <p class="text-xs text-muted-foreground">{item.description}</p>
        {/if}
        {#if item.quantity > 1}
          <p class="text-xs text-muted-foreground">
            {item.quantity} × {formatCents(item.unitAmount)}
          </p>
        {/if}
      </div>
      <span class="shrink-0 tabular-nums">{formatCents(item.quantity * item.unitAmount)}</span>
    </li>
  {/each}

  {#each discounts as discount, index (index)}
    <li class="flex items-start justify-between gap-4 text-success">
      <p class="min-w-0">{discount.name}</p>
      <span class="shrink-0 tabular-nums">−{formatCents(discount.amount)}</span>
    </li>
  {/each}

  <li class="flex justify-between gap-4 border-t pt-2 font-semibold">
    <span>Total</span>
    <span class="tabular-nums">{formatCents(total)}</span>
  </li>
</ul>
