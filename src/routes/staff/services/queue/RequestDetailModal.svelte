<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import * as Item from '$lib/components/ui/item';
  import { Spinner } from '$lib/components/ui/spinner';
  import * as Tabs from '$lib/components/ui/tabs';
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
  import { DESKTOP_BREAKPOINT, IsMobile } from '$lib/hooks/is-mobile.svelte';
  import { CENTS_PER_DOLLAR, formatCents } from '$lib/utils/billing';
  import { SERVICE_FIELD_TYPE, type ServiceRequestStatus } from '$lib/utils/services';
  import CheckIcon from '@lucide/svelte/icons/check';
  import ClipboardListIcon from '@lucide/svelte/icons/clipboard-list';
  import DownloadIcon from '@lucide/svelte/icons/download';
  import FileIcon from '@lucide/svelte/icons/file';
  import LinkIcon from '@lucide/svelte/icons/link';
  import UserIcon from '@lucide/svelte/icons/user';
  import XIcon from '@lucide/svelte/icons/x';
  import { untrack } from 'svelte';
  import { REQUEST_DETAIL_TABS, ServiceRequestDetail } from './request-detail.svelte';
  import { REQUEST_STATUS_DISPLAY } from './utils';

  type Props = ModalProps & {
    requestId: string;
    /** Opened from a blocked drop, so staff land on the quote input. */
    focusQuote?: boolean;
  };

  const { requestId, focusQuote = false, onClose }: Props = $props();

  const belowDesktop = new IsMobile(DESKTOP_BREAKPOINT);
  const detail = new ServiceRequestDetail(
    () => requestId,
    () => onClose(),
  );
  if (untrack(() => focusQuote)) detail.activeTab = REQUEST_DETAIL_TABS.CUSTOMER;

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
  description={detail.row && `Submitted ${formatDate(detail.row.request.submissionDate)}`}
  size="xl"
  icon={ClipboardListIcon}
  onClose={() => detail.close()}
  footer={detail.canCancel ? footer : undefined}
  class="flex flex-col gap-4 max-lg:px-3 lg:p-5"
>
  {#snippet headerActions()}
    {#if detail.row && detail.canChangeStatus}
      <OptionSelect
        id="service-request-status"
        class="w-36"
        options={detail.statusOptions}
        value={detail.row.request.status}
        disabled={detail.awaitingQuote}
        onValueChange={(status) => detail.changeStatus(status as ServiceRequestStatus)}
      />
    {:else if detail.row}
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
      {@const answered = request.fields.filter((field) => field.id in request.answers)}

      {#snippet details()}
        <Section title="Request Details">
          {#if answered.length === 0}
            <p class="text-sm text-muted-foreground">No answers.</p>
          {:else}
            <dl class="flex flex-col divide-y">
              {#each answered as field (field.id)}
                <div class="flex flex-col gap-1 py-2.5 first:pt-0 last:pb-0">
                  <dt class="text-xs text-muted-foreground">{field.label}</dt>
                  <dd class="text-sm break-words whitespace-pre-line">
                    {#if files[field.id]}
                      <a
                        href={files[field.id].url}
                        class="inline-flex max-w-full items-center gap-2 rounded-md border px-2.5 py-1.5 font-medium transition-colors hover:bg-muted"
                        download
                      >
                        <FileIcon class="size-4 shrink-0 text-muted-foreground" />
                        <span class="truncate">{files[field.id].name}</span>
                        <DownloadIcon class="size-4 shrink-0 text-muted-foreground" />
                      </a>
                    {:else if field.type === SERVICE_FIELD_TYPE.CHECKBOX}
                      <span class="inline-flex items-center gap-1.5">
                        <CheckIcon class="size-4 text-success" /> Yes
                      </span>
                    {:else}
                      {String(request.answers[field.id])}
                    {/if}
                  </dd>
                </div>
              {/each}
            </dl>
          {/if}
        </Section>
      {/snippet}

      {#snippet customerAndPayment()}
        <div class="flex flex-col gap-4">
          <Item.Root size="sm" variant="outline">
            <Item.Media class="size-9 translate-y-0! self-center! rounded-md bg-muted">
              <UserIcon class="size-4" />
            </Item.Media>
            <Item.Content class="min-w-0 gap-0.5">
              <Item.Title class="max-w-full truncate">{request.customerName}</Item.Title>
              <Item.Description class="truncate [&>a]:no-underline">
                <a href={`mailto:${request.email}`} class="text-primary hover:underline">
                  {request.email}
                </a>
              </Item.Description>
            </Item.Content>
          </Item.Root>

          <Section title="Payment">
            {#snippet actions()}
              {#if detail.payUrl}
                <IconButton
                  icon={LinkIcon}
                  aria-label="Copy payment link"
                  onclick={() => detail.copyPayUrl()}
                />
              {/if}
            {/snippet}
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
            {#if detail.canQuote}
              <form
                class="mt-3 flex items-end gap-2"
                onsubmit={(event) => {
                  event.preventDefault();
                  detail.saveQuote();
                }}
              >
                <label class="flex flex-1 flex-col gap-1 text-sm" {@attach focusInput}>
                  <span class="text-muted-foreground">Quote</span>
                  <PriceInput bind:value={detail.quote} multiplier={CENTS_PER_DOLLAR} />
                </label>
                <Button type="submit" disabled={!(detail.quote > 0) || detail.savingQuote}>
                  {#if detail.savingQuote}<Spinner />{/if}
                  {detail.quoteLabel}
                </Button>
              </form>
              {#if detail.awaitingQuote}
                <p class="mt-2 text-sm text-muted-foreground">Send a quote before starting work.</p>
              {/if}
            {/if}
          </Section>
        </div>
      {/snippet}

      {#if !belowDesktop.current}
        <div class="grid grid-cols-[3fr_2fr] items-start gap-4">
          <div class="min-w-0">{@render details()}</div>
          {@render customerAndPayment()}
        </div>
      {:else}
        <Tabs.Root bind:value={detail.activeTab} class="flex flex-col">
          <Tabs.List class="w-full">
            <Tabs.Trigger value={REQUEST_DETAIL_TABS.DETAILS}>
              Details ({answered.length})
            </Tabs.Trigger>
            <Tabs.Trigger value={REQUEST_DETAIL_TABS.CUSTOMER}>Customer & Payment</Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value={REQUEST_DETAIL_TABS.DETAILS}>{@render details()}</Tabs.Content>
          <Tabs.Content value={REQUEST_DETAIL_TABS.CUSTOMER}>
            {@render customerAndPayment()}
          </Tabs.Content>
        </Tabs.Root>
      {/if}
    {/if}
  </QueryState>
</Modal>
