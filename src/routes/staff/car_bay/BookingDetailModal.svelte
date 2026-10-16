<script lang="ts" module>
  import type { Tone } from '$lib/frontend/components/StatusBadge.svelte';
  import type { CarBayBookingView, CarBayOverrunInvoiceView } from '$lib/remotes/dtos/car_bay.dto';

  type Badge = { label: string; tone: Tone };

  const STATUS_BADGES: Record<CarBayBookingView['status'], Badge> = {
    confirmed: { label: 'Confirmed', tone: 'success' },
    canceled: { label: 'Canceled', tone: 'danger' },
    no_show: { label: 'No-show', tone: 'warning' },
  };

  const INVOICE_BADGES: Record<CarBayOverrunInvoiceView['status'], Badge> = {
    quote: { label: 'Quote', tone: 'neutral' },
    pending: { label: 'Sent', tone: 'info' },
    paid: { label: 'Paid', tone: 'success' },
    canceled: { label: 'Canceled', tone: 'danger' },
  };
</script>

<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Spinner } from '$lib/components/ui/spinner';
  import InfoRow from '$lib/frontend/components/InfoRow.svelte';
  import Modal from '$lib/frontend/components/Modal.svelte';
  import Section from '$lib/frontend/components/Section.svelte';
  import StatusBadge from '$lib/frontend/components/StatusBadge.svelte';
  import type { ModalProps } from '$lib/frontend/components/utils';
  import { submitWithToast } from '$lib/frontend/form-submit';
  import { modalManager } from '$lib/frontend/modal-manager.svelte';
  import { getCarBayBookingDetail, markCarBayNoShow } from '$lib/remotes/endpoints/car_bay.remote';
  import {
    CAR_BAY_REFUND_CUTOFF_HOURS,
    CAR_BAY_STATUS,
    CAR_BAY_TIER_NAMES,
    formatDollars,
    formatPeriod,
    toPeriod,
  } from '$lib/utils/car_bay';
  import BanIcon from '@lucide/svelte/icons/ban';
  import CarIcon from '@lucide/svelte/icons/car';
  import ReceiptIcon from '@lucide/svelte/icons/receipt';
  import UserXIcon from '@lucide/svelte/icons/user-x';
  import { DateTime } from 'luxon';
  import CancelBookingModal from './CancelBookingModal.svelte';
  import OverrunInvoiceModal from './OverrunInvoiceModal.svelte';

  interface Props extends ModalProps {
    bookingId: string;
    onChanged: () => Promise<void>;
  }

  let { onClose, bookingId, onChanged }: Props = $props();

  const detailRemote = $derived(getCarBayBookingDetail(bookingId));
  const detail = $derived(detailRemote.current);
  const isPaid = $derived((detail?.amountPaid ?? 0) > 0);

  let busy = $state(false);

  async function runAction(
    action: () => Promise<unknown>,
    messages: { success: string; error: string },
  ) {
    busy = true;
    const ok = await submitWithToast(action, messages);
    busy = false;
    if (ok) await onChanged();
  }

  async function cancel() {
    if (!detail) return;
    const canceled = await modalManager.show(CancelBookingModal, {
      bookingId,
      amountPaid: detail.amountPaid,
      refundable: detail.refundable,
    });
    if (canceled) await onChanged();
  }

  async function markNoShow() {
    const confirmed = await modalManager.confirm({
      title: 'Mark as No-show',
      prompt: 'Release the bay for this booking? No refund is issued for a no-show.',
      confirmText: 'Mark No-show',
      variant: 'destructive',
    });
    if (!confirmed) return;

    await runAction(() => markCarBayNoShow({ bookingId }), {
      success: 'Marked as no-show',
      error: 'Failed to mark as no-show',
    });
  }

  function sendInvoice() {
    if (!detail) return;
    modalManager.show(OverrunInvoiceModal, {
      bookingId,
      isMember: detail.isMember,
      bookingEndDate: toPeriod(detail).endAt.toISODate()!,
    });
  }
</script>

{#snippet actionsFooter()}
  <div class="flex w-full flex-wrap justify-end gap-2">
    {#if detail?.status === CAR_BAY_STATUS.CONFIRMED}
      <Button variant="outline" onclick={sendInvoice} disabled={busy}>
        <ReceiptIcon />
        Send Overrun Invoice
      </Button>
      <Button variant="outline" onclick={markNoShow} disabled={busy}>
        <UserXIcon />
        No-show
      </Button>
      <Button variant="destructive" onclick={cancel} disabled={busy}>
        <BanIcon />
        Cancel Booking
      </Button>
    {/if}
  </div>
{/snippet}

<Modal
  title={detail ? `${CAR_BAY_TIER_NAMES[detail.tier]} - ${detail.customerName}` : 'Car Bay Booking'}
  icon={CarIcon}
  {onClose}
  size="lg"
  footer={detail ? actionsFooter : undefined}
>
  {#if detailRemote.loading && !detail}
    <div class="flex justify-center py-6">
      <Spinner class="size-6" />
    </div>
  {:else if !detail}
    <p class="text-sm text-destructive">Booking not found.</p>
  {:else}
    {@const badge = STATUS_BADGES[detail.status]}
    <div class="flex flex-col gap-3">
      <Section title="Booking">
        <dl>
          <InfoRow label="When">{formatPeriod(toPeriod(detail))}</InfoRow>
          <InfoRow label="Status">
            <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
          </InfoRow>
          <InfoRow label="Rate">{detail.isMember ? 'Member' : 'Non-member'}</InfoRow>
          <InfoRow label="Paid">
            {isPaid ? formatDollars(detail.amountPaid) : 'Staff booking (free)'}
          </InfoRow>
          {#if isPaid && detail.status === CAR_BAY_STATUS.CONFIRMED}
            <InfoRow label="Refund policy">
              {detail.refundable
                ? 'Refundable'
                : `Not refundable (inside ${CAR_BAY_REFUND_CUTOFF_HOURS} hours)`}
            </InfoRow>
          {/if}
        </dl>
      </Section>

      <Section title="Customer">
        <dl>
          <InfoRow label="Name">{detail.customerName}</InfoRow>
          <InfoRow label="Email">{detail.customerEmail}</InfoRow>
          <InfoRow label="Phone">{detail.customerPhone}</InfoRow>
        </dl>
      </Section>

      <Section title="Overrun Invoices">
        {#if detail.overrunInvoices.length === 0}
          <p class="text-sm text-muted-foreground">No overrun invoices sent.</p>
        {:else}
          <ul class="-my-1.5 divide-y">
            {#each detail.overrunInvoices as invoice (invoice.id)}
              {@const invoiceBadge = INVOICE_BADGES[invoice.status]}
              <li class="flex items-center justify-between gap-3 py-1.5 text-sm">
                <span>
                  {formatDollars(invoice.total)}
                  <span class="text-muted-foreground">
                    · {DateTime.fromISO(invoice.issuedDate).toFormat('MMM d, h:mm a')}
                  </span>
                </span>
                <span class="flex items-center gap-2">
                  {#if invoice.paymentUrl}
                    <a
                      href={invoice.paymentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-xs text-primary hover:underline"
                    >
                      View
                    </a>
                  {/if}
                  <StatusBadge tone={invoiceBadge.tone}>{invoiceBadge.label}</StatusBadge>
                </span>
              </li>
            {/each}
          </ul>
        {/if}
      </Section>

      <p class="text-xs text-muted-foreground">
        No overrun or overnight charge applies if the customer moved their own vehicle outside at
        the end of the reservation. Vehicles may stay on the property up to 3 days from the start
        date.
      </p>
    </div>
  {/if}
</Modal>
