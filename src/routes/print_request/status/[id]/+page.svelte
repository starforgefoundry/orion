<script lang="ts">
  import { page } from '$app/state';
  import * as Alert from '$lib/components/ui/alert';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import { Spinner } from '$lib/components/ui/spinner';
  import CardCheckout from '$lib/frontend/components/CardCheckout.svelte';
  import InfoRow from '$lib/frontend/components/InfoRow.svelte';
  import PaymentBreakdown from '$lib/frontend/components/PaymentBreakdown.svelte';
  import Section from '$lib/frontend/components/Section.svelte';
  import StepProgress from '$lib/frontend/components/StepProgress.svelte';
  import { submitWithToast } from '$lib/frontend/form-submit';
  import { modalManager } from '$lib/frontend/modal-manager.svelte';
  import {
    getPrintRequestStatus,
    payPrintRequest,
    respondToPrintRequestQuote,
  } from '$lib/remotes/endpoints/print_request.remote';
  import { PAYMENT_STATUS } from '$lib/utils/billing';
  import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
  import Printer3dIcon from '@lucide/svelte/icons/printer-3d';
  import XIcon from '@lucide/svelte/icons/x';
  import { DateTime } from 'luxon';
  import { toast } from 'svelte-sonner';

  const CONTACT_EMAIL = '3dprint@starforgefoundry.com';
  const CANCELED = 'canceled';

  const STEPS = [
    { id: 'in_queue', label: 'In Queue' },
    { id: 'printing', label: 'Printing' },
    { id: 'done', label: 'Ready for Pickup' },
    { id: 'picked_up', label: 'Picked Up' },
  ] as const;

  const statusQuery = $derived(getPrintRequestStatus(page.params.id ?? ''));
  const request = $derived(statusQuery.current);
  const payment = $derived(request?.payment);
  const isCanceled = $derived(request?.status === CANCELED);

  let responding = $state(false);

  function formatDate(iso: string) {
    return DateTime.fromISO(iso).toLocaleString(DateTime.DATE_MED);
  }

  async function approve() {
    responding = true;
    await submitWithToast(() => respondToPrintRequestQuote({ id: request!.id, approve: true }), {
      success: 'Quote approved',
      error: 'Could not approve the quote',
    });
    responding = false;
  }

  async function decline() {
    const confirmed = await modalManager.confirm({
      title: 'Cancel Print Request',
      prompt: 'Are you sure you want to cancel this print request? This cannot be undone.',
      confirmText: 'Cancel Request',
      cancelText: 'Keep Request',
      variant: 'destructive',
    });
    if (!confirmed) return;

    responding = true;
    await submitWithToast(() => respondToPrintRequestQuote({ id: request!.id, approve: false }), {
      success: 'Print request canceled',
      error: 'Could not cancel the request',
    });
    responding = false;
  }

  async function pay(sourceId: string) {
    await payPrintRequest({ id: request!.id, sourceId });
    toast.success('Payment received. Thank you!');
  }
</script>

<svelte:head>
  <title>3D Print Request</title>
</svelte:head>

<Card.Header>
  <Card.Title class="flex items-center gap-2">
    <Printer3dIcon class="size-4 text-muted-foreground" aria-hidden="true" />
    {request?.projectName ?? '3D Print Request'}
  </Card.Title>
  {#if request}
    <Card.Description>Submitted {formatDate(request.submissionDate)}</Card.Description>
  {/if}
</Card.Header>

<Card.Content>
  {#if statusQuery.loading}
    <Spinner class="mx-auto my-6 size-8" />
  {:else if !request}
    <p class="font-medium text-destructive">We couldn't find this print request.</p>
    <p class="text-muted-foreground">
      Check that the link matches the one in your email, or contact us at
      <a href="mailto:{CONTACT_EMAIL}" class="text-primary hover:underline">{CONTACT_EMAIL}</a>.
    </p>
  {:else}
    <div class="flex flex-col gap-4">
      {#if isCanceled}
        <Alert.Root variant="destructive">
          <XIcon />
          <Alert.Title>This print request was canceled</Alert.Title>
          <Alert.Description>
            Reach out to {CONTACT_EMAIL} if you think this is a mistake.
          </Alert.Description>
        </Alert.Root>
      {:else}
        <StepProgress steps={[...STEPS]} current={request.status} showCompleted />
      {/if}

      <Section title="Cost">
        {#if !payment}
          <p class="text-sm text-muted-foreground">
            {request.isQuote
              ? "We're preparing your quote. You'll get an email when it's ready to review."
              : "We're reviewing your request. The price will show up here once we've priced your print."}
          </p>
        {:else}
          <div class="flex flex-col gap-4">
            <PaymentBreakdown
              lineItems={payment.lineItems}
              discounts={payment.discounts}
              total={payment.total}
            />

            {#if isCanceled}
              <p class="text-sm text-muted-foreground">Nothing is due on a canceled request.</p>
            {:else if payment.status === PAYMENT_STATUS.QUOTE}
              <p class="text-sm text-muted-foreground">
                We won't start printing until you approve this quote. You can pay right after
                approving it.
              </p>
              {#if responding}
                <Spinner class="mx-auto my-2 size-6" />
              {:else}
                <div class="grid gap-2 sm:grid-cols-2">
                  <Button onclick={approve}>
                    <CircleCheckIcon />
                    Approve Quote
                  </Button>
                  <Button variant="outline" onclick={decline}>
                    <XIcon />
                    Cancel Request
                  </Button>
                </div>
              {/if}
            {:else if payment.status === PAYMENT_STATUS.PAID}
              <p class="flex items-center gap-2 text-sm font-medium text-success">
                <CircleCheckIcon class="size-4" />
                {payment.billedToOrganization
                  ? 'Billed to your organization'
                  : `Paid${payment.paymentDate ? ` on ${formatDate(payment.paymentDate)}` : ''}`}
              </p>
            {:else if payment.status === PAYMENT_STATUS.PENDING && payment.billedToOrganization}
              <p class="text-sm text-muted-foreground">
                This print is billed to your organization. There is nothing for you to pay.
              </p>
            {:else if payment.status === PAYMENT_STATUS.PENDING && payment.invoiceUrl}
              <Button href={payment.invoiceUrl} target="_blank">Pay Invoice</Button>
            {:else if payment.status === PAYMENT_STATUS.PENDING}
              <CardCheckout total={payment.total} onPay={pay} />
            {/if}
          </div>
        {/if}
      </Section>

      <Section title="Request Details">
        <dl>
          <InfoRow label="Name">{request.customerName}</InfoRow>
          <InfoRow label="Material">{request.materialName}</InfoRow>
          {#each request.files as file, index (index)}
            <InfoRow label={index === 0 ? 'Files' : ''}>
              {file.fileName}{file.quantity > 1 ? ` ×${file.quantity}` : ''}
            </InfoRow>
          {/each}
        </dl>
      </Section>

      <p class="text-center text-xs text-muted-foreground">
        Bookmark this page to check on your print at any time. Questions? Email
        <a href="mailto:{CONTACT_EMAIL}" class="text-primary hover:underline">{CONTACT_EMAIL}</a>.
      </p>
    </div>
  {/if}
</Card.Content>
