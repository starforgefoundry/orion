<script lang="ts">
  import { Spinner } from '$lib/components/ui/spinner';
  import type { SquarePayment } from '$lib/frontend/square-payment.svelte';
  import { getCheckoutConfig } from '$lib/remotes/endpoints/payment.remote';

  let { payment }: { payment: SquarePayment } = $props();

  const squareConfig = $derived(getCheckoutConfig().current);
</script>

{#if squareConfig}
  <div {@attach payment.attach(squareConfig)}></div>
{/if}
{#if !payment.ready}
  <div
    class="flex h-24 items-center justify-center rounded-lg border"
    aria-label="Loading payment form"
  >
    <Spinner class="size-5 text-muted-foreground" />
  </div>
{/if}
