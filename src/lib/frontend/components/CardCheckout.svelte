<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Spinner } from '$lib/components/ui/spinner';
  import { errorDescription } from '$lib/frontend/form-submit';
  import { squareCard, type SquareCard } from '$lib/frontend/square-card';
  import { getSquareConfig } from '$lib/remotes/endpoints/class.remote';
  import { formatCents } from '$lib/utils/billing';
  import CreditCardIcon from '@lucide/svelte/icons/credit-card';
  import { toast } from 'svelte-sonner';

  const TOKENIZED = 'OK';

  type Props = {
    total: number;
    /** Receives a single-use card token. Rejects when the charge fails. */
    onPay: (sourceId: string) => Promise<unknown>;
  };

  let { total, onPay }: Props = $props();

  const squareConfig = $derived(getSquareConfig().current);

  let card = $state<SquareCard>();
  let paying = $state(false);

  async function pay() {
    if (!card) return;

    paying = true;
    try {
      const result = await card.tokenize();
      if (result.status !== TOKENIZED || !result.token) {
        toast.error('Payment card error. Please check your card details.');
        return;
      }
      await onPay(result.token);
    } catch (error) {
      toast.error('Payment failed', { description: errorDescription(error) });
    } finally {
      paying = false;
    }
  }
</script>

<div class="flex flex-col gap-3">
  {#if squareConfig}
    <div {@attach squareCard(squareConfig, (created) => (card = created))}></div>
  {/if}
  {#if !card}
    <div
      class="flex h-24 items-center justify-center rounded-lg border"
      aria-label="Loading payment form"
    >
      <Spinner class="size-5 text-muted-foreground" />
    </div>
  {/if}

  <Button size="lg" disabled={!card || paying} onclick={pay}>
    {#if paying}<Spinner />{:else}<CreditCardIcon />{/if}
    Pay {formatCents(total)}
  </Button>
</div>
