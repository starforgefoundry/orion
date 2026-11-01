<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Spinner } from '$lib/components/ui/spinner';
  import SquareCardField from '$lib/frontend/components/SquareCardField.svelte';
  import { SquarePayment } from '$lib/frontend/square-payment.svelte';
  import { formatCents } from '$lib/utils/billing';
  import CreditCardIcon from '@lucide/svelte/icons/credit-card';

  type Props = {
    total: number;
    /** Receives a single-use card token. Rejects when the charge fails. */
    onPay: (sourceId: string) => Promise<unknown>;
  };

  let { total, onPay }: Props = $props();

  const payment = new SquarePayment();
</script>

<div class="flex flex-col gap-3">
  <SquareCardField {payment} />

  <Button
    size="lg"
    disabled={!payment.ready || payment.paying}
    onclick={() => payment.pay(onPay, 'Payment failed')}
  >
    {#if payment.paying}<Spinner />{:else}<CreditCardIcon />{/if}
    Pay {formatCents(total)}
  </Button>
</div>
