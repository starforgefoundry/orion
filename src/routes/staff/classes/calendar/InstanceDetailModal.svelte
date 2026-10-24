<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Spinner } from '$lib/components/ui/spinner';
  import InfoRow from '$lib/frontend/components/InfoRow.svelte';
  import Modal from '$lib/frontend/components/Modal.svelte';
  import Section from '$lib/frontend/components/Section.svelte';
  import StatusBadge from '$lib/frontend/components/StatusBadge.svelte';
  import type { ModalProps } from '$lib/frontend/components/utils';
  import { modalManager } from '$lib/frontend/modal-manager.svelte';
  import { formatTime } from '$lib/frontend/utils';
  import { formatCents, PAYMENT_STATUS } from '$lib/utils/billing';
  import {
    cancelBookingStaff,
    cancelInstance,
    getAllInstances,
    getInstanceDetail,
  } from '$lib/remotes/endpoints/class.remote';
  import BanIcon from '@lucide/svelte/icons/ban';
  import CalendarIcon from '@lucide/svelte/icons/calendar';
  import TrashIcon from '@lucide/svelte/icons/trash';
  import UserPlusIcon from '@lucide/svelte/icons/user-plus';
  import { DateTime } from 'luxon';
  import { toast } from 'svelte-sonner';
  import AddBookingModal from './AddBookingModal.svelte';
  import CancelClassModal from './CancelClassModal.svelte';

  interface Props extends ModalProps {
    instanceId: string;
  }

  let { onClose, instanceId }: Props = $props();

  function isPaid(booking: any) {
    return booking.payment?.status === PAYMENT_STATUS.PAID && booking.payment.total > 0;
  }

  const detailRemote = $derived(getInstanceDetail(instanceId));
  const detail = $derived(detailRemote.current);
  const confirmedBookings = $derived(
    detail?.bookings?.filter((b: any) => b.status === 'confirmed') ?? [],
  );
  const canceledBookings = $derived(
    detail?.bookings?.filter((b: any) => b.status === 'canceled') ?? [],
  );
  const totalBooked = $derived(
    confirmedBookings.reduce((sum: number, b: any) => sum + (b.quantity ?? 1), 0),
  );

  let cancelingBookingId = $state('');

  async function handleCancelBooking(booking: any) {
    const hasPaid = isPaid(booking);
    const confirmed = await modalManager.confirm({
      title: 'Cancel Booking',
      prompt: hasPaid
        ? 'Cancel this booking and issue a full refund?'
        : 'Cancel this booking? No refund will be issued.',
      confirmText: hasPaid ? 'Cancel & Refund' : 'Cancel Booking',
      variant: 'destructive',
    });
    if (!confirmed) return;

    cancelingBookingId = booking.id;
    try {
      await cancelBookingStaff({ bookingId: booking.id });
      await getInstanceDetail(instanceId).refresh();
      await getAllInstances().refresh();
    } catch (error: any) {
      toast.error(error?.message ?? 'Failed to cancel booking');
    } finally {
      cancelingBookingId = '';
    }
  }

  function showAddBookingModal() {
    const available = (detail?.seats ?? 0) - totalBooked;
    modalManager.show(AddBookingModal, {
      instanceId,
      availableSpots: available,
      onBookingCreated: async () => {
        await getInstanceDetail(instanceId).refresh();
        await getAllInstances().refresh();
      },
    });
  }

  function showCancelModal() {
    modalManager.show(CancelClassModal, {
      hasRecurrenceGroup: !!detail?.recurrenceGroupId,
      onConfirm: async (mode: 'single' | 'this_and_future') => {
        try {
          const result = await cancelInstance({ instanceId, mode });
          toast.success(
            `Canceled ${result.canceledCount} class${result.canceledCount !== 1 ? 'es' : ''}`,
          );
          await getAllInstances().refresh();
          onClose();
        } catch (error: any) {
          toast.error(error?.message ?? 'Failed to cancel');
        }
      },
    });
  }
</script>

{#snippet cancelClassFooter()}
  <Button variant="destructive" onclick={showCancelModal}>
    <BanIcon />
    Cancel Class
  </Button>
{/snippet}

<Modal
  title={detail?.catalog?.name ?? 'Class Details'}
  icon={CalendarIcon}
  {onClose}
  size="lg"
  footer={detail?.status === 'scheduled' ? cancelClassFooter : undefined}
>
  {#if detailRemote.loading}
    <div class="flex justify-center py-6">
      <Spinner class="size-6" />
    </div>
  {:else if detail}
    <div class="flex flex-col gap-3">
      <Section title="Details">
        <dl>
          <InfoRow label="Date"
            >{DateTime.fromISO(detail.date).toFormat('EEE, MMM d, yyyy')}</InfoRow
          >
          <InfoRow label="Time">{formatTime(detail.startTime)} ({detail.durationMinutes}m)</InfoRow>
          <InfoRow label="Teacher">{detail.teacher?.name ?? detail.teacherEmail}</InfoRow>
          <InfoRow label="Seats">{totalBooked}/{detail.seats} booked</InfoRow>
          <InfoRow label="Status">
            <StatusBadge tone={detail.status === 'scheduled' ? 'success' : 'danger'}>
              {detail.status === 'scheduled' ? 'Scheduled' : 'Canceled'}
            </StatusBadge>
          </InfoRow>
        </dl>
      </Section>

      {#if detail.status === 'scheduled'}
        <Section title="Bookings">
          {#snippet actions()}
            {#if totalBooked < detail.seats}
              <Button size="sm" variant="ghost" onclick={showAddBookingModal}>
                <UserPlusIcon />
                Add Booking
              </Button>
            {/if}
          {/snippet}
          {#if confirmedBookings.length === 0}
            <p class="text-sm text-muted-foreground">No bookings yet.</p>
          {:else}
            <ul class="-my-1.5 divide-y">
              {#each confirmedBookings as booking (booking.id)}
                <li class="flex items-center justify-between gap-3 py-1.5 text-sm">
                  <div class="min-w-0">
                    <div class="truncate font-medium">
                      {booking.customerName}{booking.quantity > 1 ? ` (x${booking.quantity})` : ''}
                    </div>
                    <div class="truncate text-xs text-muted-foreground">
                      {booking.customerEmail} · {booking.customerPhone}
                    </div>
                    <div class="text-xs text-muted-foreground">
                      {#if isPaid(booking)}
                        {formatCents(booking.payment?.total ?? 0)}
                      {:else}
                        Manual (no payment)
                      {/if}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    class="shrink-0 text-destructive hover:text-destructive"
                    onclick={() => handleCancelBooking(booking)}
                    disabled={cancelingBookingId === booking.id}
                  >
                    {#if cancelingBookingId === booking.id}<Spinner />{:else}<TrashIcon />{/if}
                    {isPaid(booking) ? 'Cancel & Refund' : 'Cancel'}
                  </Button>
                </li>
              {/each}
            </ul>
          {/if}
        </Section>

        {#if canceledBookings.length > 0}
          <Section title="Canceled Bookings">
            <ul class="flex flex-col gap-1 text-sm text-muted-foreground">
              {#each canceledBookings as booking (booking.id)}
                <li>
                  {booking.customerName}{booking.quantity > 1 ? ` (x${booking.quantity})` : ''}
                  {#if booking.payment?.status === PAYMENT_STATUS.REFUNDED}
                    - {formatCents(booking.payment?.total ?? 0)} (refunded)
                  {:else}
                    (canceled)
                  {/if}
                </li>
              {/each}
            </ul>
          </Section>
        {/if}
      {/if}
    </div>
  {:else}
    <p class="text-sm text-destructive">Class not found.</p>
  {/if}
</Modal>
