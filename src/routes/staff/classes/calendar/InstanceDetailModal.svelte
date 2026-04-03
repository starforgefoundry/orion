<script lang="ts">
  import type { ModalProps } from '$lib/frontend/components/utils';
  import { formatTime } from '$lib/frontend/utils';
  import {
    cancelBookingStaff,
    cancelInstance,
    getAllInstances,
    getInstanceDetail,
  } from '$lib/remotes/endpoints/class.remote';
  import {
    Badge,
    Button,
    Heading,
    LoadingSpinner,
    Modal,
    ModalBody,
    modalManager,
    Stack,
    Text,
    toastManager,
  } from '@immich/ui';
  import { mdiCalendar, mdiCancel, mdiDelete } from '@mdi/js';
  import { DateTime } from 'luxon';
  import CancelClassModal from './CancelClassModal.svelte';

  interface Props extends ModalProps {
    instanceId: string;
  }

  let { onClose, instanceId }: Props = $props();

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

  async function handleCancelBooking(bookingId: string) {
    const confirmed = await modalManager.showDialog({
      title: 'Cancel Booking',
      prompt: 'Cancel this booking and issue a full refund?',
      confirmText: 'Cancel & Refund',
      confirmColor: 'danger',
    });
    if (!confirmed) return;

    cancelingBookingId = bookingId;
    try {
      await cancelBookingStaff({ bookingId });
      await getInstanceDetail(instanceId).refresh();
      await getAllInstances().refresh();
    } catch (error: any) {
      toastManager.danger(error?.message ?? 'Failed to cancel booking');
    } finally {
      cancelingBookingId = '';
    }
  }

  function showCancelModal() {
    modalManager.show(CancelClassModal, {
      hasRecurrenceGroup: !!detail?.recurrenceGroupId,
      onConfirm: async (mode: 'single' | 'this_and_future') => {
        try {
          const result = await cancelInstance({ instanceId, mode });
          toastManager.success(
            `Canceled ${result.canceledCount} class${result.canceledCount !== 1 ? 'es' : ''}`,
          );
          await getAllInstances().refresh();
          onClose();
        } catch (error: any) {
          toastManager.danger(error?.message ?? 'Failed to cancel');
        }
      },
    });
  }
</script>

<Modal
  title={detail?.catalog?.name ?? 'Class Details'}
  icon={mdiCalendar}
  {onClose}
  size="large"
>
  <ModalBody>
    {#if detailRemote.loading}
      <LoadingSpinner class="mx-auto" size="large" />
    {:else if detail}
      <Stack gap={4}>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <Text color="muted" size="small">Date</Text>
            <Text fontWeight="bold"
              >{DateTime.fromISO(detail.date).toFormat('EEEE, MMMM d, yyyy')}</Text
            >
          </div>
          <div>
            <Text color="muted" size="small">Time</Text>
            <Text fontWeight="bold"
              >{formatTime(detail.startTime)} ({detail.durationMinutes}m)</Text
            >
          </div>
          <div>
            <Text color="muted" size="small">Teacher</Text>
            <Text fontWeight="bold">{detail.teacher?.name ?? detail.teacherEmail}</Text>
          </div>
          <div>
            <Text color="muted" size="small">Seats</Text>
            <Text fontWeight="bold">
              {totalBooked}/{detail.seats} booked
            </Text>
          </div>
        </div>

        <Badge color={detail.status === 'scheduled' ? 'success' : 'danger'} class="self-start">
          {detail.status === 'scheduled' ? 'Scheduled' : 'Canceled'}
        </Badge>

        {#if detail.status === 'scheduled'}
          <Stack gap={2}>
            <Heading size="small">Bookings</Heading>
            {#if confirmedBookings.length === 0}
              <Text color="muted" size="small">No bookings yet.</Text>
            {:else}
              {#each confirmedBookings as booking}
                <div
                  class="flex items-center justify-between rounded-lg border border-gray-700 p-3"
                >
                  <div>
                    <Text fontWeight="bold" size="small">
                      {booking.customerName}{booking.quantity > 1 ? ` (x${booking.quantity})` : ''}
                    </Text>
                    <Text size="small" color="muted"
                      >{booking.customerEmail} · {booking.customerPhone}</Text
                    >
                    <Text size="small" color="muted"
                      >${(booking.amountPaid / 100).toFixed(2)}</Text
                    >
                  </div>
                  <Button
                    size="small"
                    color="danger"
                    variant="outline"
                    leadingIcon={mdiDelete}
                    onclick={() => handleCancelBooking(booking.id)}
                    loading={cancelingBookingId === booking.id}
                  >
                    Cancel & Refund
                  </Button>
                </div>
              {/each}
            {/if}
          </Stack>

          {#if canceledBookings.length > 0}
            <Stack gap={2}>
              <Heading size="small">Canceled Bookings</Heading>
              {#each canceledBookings as booking}
                <div class="rounded-lg border border-gray-700 p-3 opacity-50">
                  <Text size="small"
                    >{booking.customerName}{booking.quantity > 1 ? ` (x${booking.quantity})` : ''} - ${(booking.amountPaid / 100).toFixed(2)} (refunded)</Text
                  >
                </div>
              {/each}
            </Stack>
          {/if}

          <div class="border-t border-gray-700 pt-4">
            <Button
              color="danger"
              variant="outline"
              leadingIcon={mdiCancel}
              onclick={showCancelModal}
              fullWidth
            >
              Cancel Class
            </Button>
          </div>
        {/if}
      </Stack>
    {:else}
      <Text color="danger">Class not found.</Text>
    {/if}
  </ModalBody>
</Modal>
