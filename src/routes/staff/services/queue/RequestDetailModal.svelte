<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Spinner } from '$lib/components/ui/spinner';
  import IconButton from '$lib/frontend/components/IconButton.svelte';
  import InfoRow from '$lib/frontend/components/InfoRow.svelte';
  import Modal from '$lib/frontend/components/Modal.svelte';
  import OptionSelect from '$lib/frontend/components/form/OptionSelect.svelte';
  import PriceInput from '$lib/frontend/components/form/PriceInput.svelte';
  import QueryState from '$lib/frontend/components/QueryState.svelte';
  import Section from '$lib/frontend/components/Section.svelte';
  import StatusBadge from '$lib/frontend/components/StatusBadge.svelte';
  import type { ModalProps } from '$lib/frontend/components/utils';
  import { formatDate } from '$lib/frontend/format';
  import { PAYMENT_STATUS_DISPLAY } from '$lib/frontend/payment-status';
  import { CENTS_PER_DOLLAR, formatCents } from '$lib/utils/billing';
  import { SERVICE_FIELD_TYPE, type ServiceRequestStatus } from '$lib/utils/services';
  import ClipboardListIcon from '@lucide/svelte/icons/clipboard-list';
  import CopyIcon from '@lucide/svelte/icons/copy';
  import XIcon from '@lucide/svelte/icons/x';
  import { ServiceRequestDetail } from './request-detail.svelte';
  import { REQUEST_STATUS_DISPLAY } from './utils';

  type Props = ModalProps & {
    requestId: string;
    /** Opened from a blocked drop, so staff land on the quote input. */
    focusQuote?: boolean;
  };

  const { requestId, focusQuote = false, onClose }: Props = $props();

  const detail = new ServiceRequestDetail(
    () => requestId,
    () => onClose(),
  );

  // Focusing before the dialog's own autofocus runs keeps focus on the quote input.
  function focusInput(element: HTMLElement) {
    if (focusQuote) element.querySelector('input')?.focus();
  }
</script>

{#snippet footer()}
  <Button
    variant="ghost"
    class="text-destructive hover:text-destructive sm:mr-auto"
    onclick={() => detail.cancel()}
  >
    <XIcon />
    Cancel Request
  </Button>
{/snippet}

<Modal
  title={detail.row?.serviceName ?? 'Service Request'}
  description={detail.row?.request.customerName}
  size="lg"
  icon={ClipboardListIcon}
  onClose={() => detail.close()}
  footer={detail.canCancel ? footer : undefined}
  class="flex flex-col gap-3"
>
  {#snippet headerActions()}
    {#if detail.row}
      {@const display = REQUEST_STATUS_DISPLAY[detail.row.request.status]}
      <StatusBadge tone={display.tone}>{display.label}</StatusBadge>
    {/if}
  {/snippet}

  <QueryState query={detail.query} label="service request">
    {#if !detail.row}
      <p class="text-sm text-destructive">Request not found.</p>
    {:else}
      {@const { request, payment, files } = detail.row}
      {@const paymentDisplay = PAYMENT_STATUS_DISPLAY[payment.status]}
      <Section title="Request">
        <dl>
          <InfoRow label="Customer">{request.customerName}</InfoRow>
          <InfoRow label="Email">
            <a href={`mailto:${request.email}`} class="text-primary hover:underline">
              {request.email}
            </a>
          </InfoRow>
          <InfoRow label="Submitted">{formatDate(request.submissionDate)}</InfoRow>
          {#if detail.canChangeStatus}
            <InfoRow label="Status">
              <OptionSelect
                id="service-request-status"
                class="w-40"
                options={detail.statusOptions}
                value={request.status}
                disabled={detail.awaitingQuote}
                onValueChange={(status) => detail.changeStatus(status as ServiceRequestStatus)}
              />
            </InfoRow>
          {/if}
        </dl>
        {#if detail.canChangeStatus && detail.awaitingQuote}
          <p class="mt-1 text-sm text-muted-foreground">Send a quote before starting work.</p>
        {/if}
      </Section>

      <Section title="Answers">
        {@const answered = request.fields.filter((field) => field.id in request.answers)}
        {#if answered.length === 0}
          <p class="text-sm text-muted-foreground">No answers.</p>
        {:else}
          <dl class="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
            {#each answered as field (field.id)}
              <dt class="text-muted-foreground">{field.label}</dt>
              <dd class="break-words whitespace-pre-line">
                {#if files[field.id]}
                  <a href={files[field.id].url} class="text-primary hover:underline" download>
                    {files[field.id].name}
                  </a>
                {:else if field.type === SERVICE_FIELD_TYPE.CHECKBOX}
                  Yes
                {:else}
                  {String(request.answers[field.id])}
                {/if}
              </dd>
            {/each}
          </dl>
        {/if}
      </Section>

      <Section title="Payment">
        <dl>
          <InfoRow label="Status">
            {#if detail.awaitingQuote}
              <StatusBadge tone="warning">Awaiting Quote</StatusBadge>
            {:else}
              <StatusBadge tone={paymentDisplay.tone}>{paymentDisplay.label}</StatusBadge>
            {/if}
          </InfoRow>
          {#if !detail.awaitingQuote}
            <InfoRow label="Total">
              <span class="tabular-nums">{formatCents(payment.total)}</span>
            </InfoRow>
          {/if}
        </dl>
        {#if detail.payUrl}
          <div class="mt-2 flex items-center gap-1">
            <a
              href={detail.payUrl}
              target="_blank"
              class="min-w-0 flex-1 truncate font-mono text-xs text-primary hover:underline"
            >
              {detail.payUrl}
            </a>
            <IconButton
              icon={CopyIcon}
              aria-label="Copy payment link"
              onclick={() => detail.copyPayUrl()}
            />
          </div>
        {/if}
        {#if detail.canQuote}
          <form
            class="mt-3 flex items-end gap-2"
            onsubmit={(event) => {
              event.preventDefault();
              detail.saveQuote();
            }}
          >
            <label class="flex flex-col gap-1 text-sm" {@attach focusInput}>
              <span class="text-muted-foreground">Quote</span>
              <PriceInput bind:value={detail.quote} multiplier={CENTS_PER_DOLLAR} />
            </label>
            <Button type="submit" disabled={!(detail.quote > 0) || detail.savingQuote}>
              {#if detail.savingQuote}<Spinner />{/if}
              {detail.quoteLabel}
            </Button>
          </form>
        {/if}
      </Section>
    {/if}
  </QueryState>
</Modal>
