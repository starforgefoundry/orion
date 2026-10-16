<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import { Spinner } from '$lib/components/ui/spinner';
  import InfoRow from '$lib/frontend/components/InfoRow.svelte';
  import Section from '$lib/frontend/components/Section.svelte';
  import { modalManager } from '$lib/frontend/modal-manager.svelte';
  import {
    getPrintRequestQuote,
    respondToPrintRequestQuote,
  } from '$lib/remotes/endpoints/print_request.remote';
  import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
  import ReceiptIcon from '@lucide/svelte/icons/receipt';
  import XIcon from '@lucide/svelte/icons/x';
  import type { Order } from 'square';

  const requestRemote = getPrintRequestQuote(page.url.searchParams.get('id') ?? '');
  const request = $derived(requestRemote.current);
  const payment = $derived(request?.payment);

  const order = $derived(JSON.parse(payment?.orderObject ?? '{}') as Order);
  const totalCost = $derived((payment?.total ?? 0) / 100);

  let submitting = $state(false);

  async function handleApprove() {
    submitting = true;

    const response = await respondToPrintRequestQuote({
      id: request!.id,
      approve: true,
    });

    if (response?.paymentUrl) {
      window.location.href = response.paymentUrl;
    } else {
      await goto('/print_request/quote/approved');
    }
  }

  async function handleCancel() {
    const cancel = await modalManager.confirm({
      title: 'Cancel Print Request',
      prompt: 'Are you sure you want to cancel this print request? This action cannot be undone.',
      confirmText: 'Cancel Request',
      cancelText: 'Keep Request',
      variant: 'destructive',
    });

    if (cancel) {
      submitting = true;

      await respondToPrintRequestQuote({
        id: request!.id,
        approve: false,
      });

      await goto('/print_request/quote/canceled');
    }
  }
</script>

<Card.Header>
  <Card.Title class="flex items-center gap-2">
    <ReceiptIcon class="size-4 text-muted-foreground" aria-hidden="true" />
    3D Print Request Quote
  </Card.Title>
</Card.Header>
<Card.Content>
  {#if requestRemote.loading}
    <Spinner class="mx-auto my-6 size-8" />
  {:else if requestRemote.error || !request || !request.payment}
    <p class="font-medium text-destructive">Unable to fetch quote for this print request.</p>
    <p class="text-muted-foreground">
      This could be because you have already replied to the quote or the quote is no longer
      available.
    </p>
    <p class="text-muted-foreground">
      If you have any questions, please contact us at
      <a href="mailto:3dprint@starforgefoundry.com" class="text-primary hover:underline">
        3dprint@starforgefoundry.com
      </a>
    </p>
  {:else}
    <div class="flex flex-col gap-4">
      <div>
        <p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">Total</p>
        <p class="text-3xl font-semibold tabular-nums">${totalCost.toFixed(2)}</p>
      </div>

      {#if submitting}
        <Spinner class="mx-auto my-2 size-8" />
      {:else}
        <div class="grid gap-2 sm:grid-cols-2">
          <Button onclick={handleApprove}>
            <CircleCheckIcon />
            Approve Quote
          </Button>
          <Button variant="destructive" onclick={handleCancel}>
            <XIcon />
            Cancel Request
          </Button>
        </div>
      {/if}

      <Section title="Request Details">
        <dl>
          <InfoRow label="Project Name">{request?.projectName}</InfoRow>
          <InfoRow label="Material">{request?.material?.name}</InfoRow>
          <InfoRow label="Email">{request?.email}</InfoRow>
        </dl>
      </Section>

      <Section title="Price Breakdown">
        <ul class="flex flex-col gap-2 text-sm">
          {#each order.lineItems as item}
            <li class="flex items-start justify-between gap-4">
              <div class="min-w-0">
                <p>{item.name?.replace('3D Print Request - ', '')}</p>
                {#if Number(item.quantity) > 1}
                  <p class="text-xs text-muted-foreground">
                    {item.quantity}x - ${(Number(item.basePriceMoney?.amount ?? 0) / 100).toFixed(
                      2,
                    )} each
                  </p>
                {/if}
              </div>
              <span class="shrink-0 tabular-nums">
                ${(Number(item.grossSalesMoney?.amount ?? 0) / 100).toFixed(2)}
              </span>
            </li>
          {/each}

          {#each order.discounts as discount}
            <li class="flex items-start justify-between gap-4">
              <div class="min-w-0">
                <p>{discount.name?.replace('3D Print Request - ', '')}</p>
                {#if Number(discount.percentage) > 0}
                  <p class="text-xs text-muted-foreground">
                    {Number(discount.percentage).toFixed(0)}% Off
                  </p>
                {/if}
              </div>
              <span class="shrink-0 tabular-nums">
                - ${discount.appliedMoney
                  ? (
                      Number(
                        discount.appliedMoney?.amount ?? 0 * (Number(discount.percentage) / 100),
                      ) / 100
                    ).toFixed(2)
                  : '0.00'}
              </span>
            </li>
          {/each}

          <li class="flex justify-between gap-4 border-t pt-2 font-semibold">
            <span>Total</span>
            <span class="tabular-nums">${totalCost.toFixed(2)}</span>
          </li>
        </ul>
      </Section>
    </div>
  {/if}
</Card.Content>
