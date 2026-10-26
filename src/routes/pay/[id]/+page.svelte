<script lang="ts">
  import { page } from '$app/state';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import { Spinner } from '$lib/components/ui/spinner';
  import CardCheckout from '$lib/frontend/components/CardCheckout.svelte';
  import PaymentBreakdown from '$lib/frontend/components/PaymentBreakdown.svelte';
  import { getPaymentCheckout, payPayment } from '$lib/remotes/endpoints/payment.remote';
  import { PAYMENT_STATUS } from '$lib/utils/billing';
  import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
  import ReceiptIcon from '@lucide/svelte/icons/receipt';
  import { DateTime } from 'luxon';
  import { toast } from 'svelte-sonner';

  const CONTACT_EMAIL = 'contact@starforgefoundry.com';

  const checkoutQuery = $derived(getPaymentCheckout(page.params.id ?? ''));
  const checkout = $derived(checkoutQuery.current);

  function formatDate(iso: string) {
    return DateTime.fromISO(iso).toLocaleString(DateTime.DATE_MED);
  }

  async function pay(sourceId: string) {
    await payPayment({ id: checkout!.id, sourceId });
    toast.success('Payment received. Thank you!');
  }
</script>

<svelte:head>
  <title>Starforge Payment</title>
</svelte:head>

<div class="flex min-h-dvh items-center justify-center bg-muted/40 px-4 py-8">
  <Card.Root class="w-full max-w-lg shadow-lg">
    <Card.Header>
      <Card.Title class="flex items-center gap-2">
        <ReceiptIcon class="size-4 text-muted-foreground" aria-hidden="true" />
        {checkout?.title ?? 'Payment'}
      </Card.Title>
      {#if checkout}
        <Card.Description>
          For {checkout.customerName} · Issued {formatDate(checkout.issuedDate)}
        </Card.Description>
      {/if}
    </Card.Header>

    <Card.Content>
      {#if checkoutQuery.loading}
        <Spinner class="mx-auto my-6 size-8" />
      {:else if !checkout}
        <p class="font-medium text-destructive">We couldn't find this payment.</p>
        <p class="text-sm text-muted-foreground">
          Check that the link matches the one in your email, or contact us at
          <a href="mailto:{CONTACT_EMAIL}" class="text-primary hover:underline">{CONTACT_EMAIL}</a>.
        </p>
      {:else}
        <div class="flex flex-col gap-4">
          <PaymentBreakdown
            lineItems={checkout.lineItems}
            discounts={checkout.discounts}
            total={checkout.total}
          />

          {#if checkout.status === PAYMENT_STATUS.PAID}
            <p class="flex items-center gap-2 text-sm font-medium text-success">
              <CircleCheckIcon class="size-4" />
              Paid{checkout.paymentDate ? ` on ${formatDate(checkout.paymentDate)}` : ''}
            </p>
          {:else if checkout.status === PAYMENT_STATUS.PENDING && checkout.invoiceUrl}
            <Button href={checkout.invoiceUrl} target="_blank">Pay Invoice</Button>
          {:else if checkout.payable}
            <CardCheckout total={checkout.total} onPay={pay} />
          {:else if checkout.status === PAYMENT_STATUS.PENDING}
            <p class="text-sm text-muted-foreground">
              This is billed to your organization. There is nothing for you to pay.
            </p>
          {:else if checkout.status === PAYMENT_STATUS.PROCESSING}
            <p class="text-sm text-muted-foreground">Your payment is being processed.</p>
          {:else}
            <p class="text-sm text-muted-foreground">This payment is no longer due.</p>
          {/if}
        </div>
      {/if}
    </Card.Content>
  </Card.Root>
</div>
