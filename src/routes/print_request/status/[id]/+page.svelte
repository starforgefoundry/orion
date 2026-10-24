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
  import { PAYMENT_STATUS } from '$lib/utils/billing';
  import { PRINT_REQUEST_STATUS } from '$lib/utils/print_request';
  import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
  import Printer3dIcon from '@lucide/svelte/icons/printer-3d';
  import XIcon from '@lucide/svelte/icons/x';
  import { DateTime } from 'luxon';
  import { PrintRequestStatusManager } from './print-request-status.svelte';

  const CONTACT_EMAIL = '3dprint@starforgefoundry.com';

  const STEPS = [
    { id: PRINT_REQUEST_STATUS.IN_QUEUE, label: 'In Queue' },
    { id: PRINT_REQUEST_STATUS.PRINTING, label: 'Printing' },
    { id: PRINT_REQUEST_STATUS.DONE, label: 'Ready for Pickup' },
    { id: PRINT_REQUEST_STATUS.PICKED_UP, label: 'Picked Up' },
  ] as const;

  const manager = new PrintRequestStatusManager(page.params.id ?? '');
  const request = $derived(manager.request);
  const payment = $derived(manager.payment);

  function formatDate(iso: string) {
    return DateTime.fromISO(iso).toLocaleString(DateTime.DATE_MED);
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
  {#if manager.query.loading}
    <Spinner class="mx-auto my-6 size-8" />
  {:else if !request}
    <p class="font-medium text-destructive">We couldn't find this print request.</p>
    <p class="text-muted-foreground">
      Check that the link matches the one in your email, or contact us at
      <a href="mailto:{CONTACT_EMAIL}" class="text-primary hover:underline">{CONTACT_EMAIL}</a>.
    </p>
  {:else}
    <div class="flex flex-col gap-4">
      {#if manager.isCanceled}
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

            {#if manager.isCanceled}
              <p class="text-sm text-muted-foreground">Nothing is due on a canceled request.</p>
            {:else if payment.status === PAYMENT_STATUS.QUOTE}
              <p class="text-sm text-muted-foreground">
                We won't start printing until you approve this quote. You can pay right after
                approving it.
              </p>
              {#if manager.responding}
                <Spinner class="mx-auto my-2 size-6" />
              {:else}
                <div class="grid gap-2 sm:grid-cols-2">
                  <Button onclick={() => manager.approve()}>
                    <CircleCheckIcon />
                    Approve Quote
                  </Button>
                  <Button variant="outline" onclick={() => manager.decline()}>
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
              <CardCheckout total={payment.total} onPay={(sourceId) => manager.pay(sourceId)} />
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
