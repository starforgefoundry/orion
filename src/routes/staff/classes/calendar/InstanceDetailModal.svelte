<script lang="ts">
  import { DATE_FORMAT } from '$lib/frontend/format';
  import { Button } from '$lib/components/ui/button';
  import { Spinner } from '$lib/components/ui/spinner';
  import InfoRow from '$lib/frontend/components/InfoRow.svelte';
  import Modal from '$lib/frontend/components/Modal.svelte';
  import QueryState from '$lib/frontend/components/QueryState.svelte';
  import Section from '$lib/frontend/components/Section.svelte';
  import StatusBadge from '$lib/frontend/components/StatusBadge.svelte';
  import type { ModalProps } from '$lib/frontend/components/utils';
  import { formatTime } from '$lib/frontend/utils';
  import { formatCents } from '$lib/utils/billing';
  import BanIcon from '@lucide/svelte/icons/ban';
  import CalendarIcon from '@lucide/svelte/icons/calendar';
  import CalendarClockIcon from '@lucide/svelte/icons/calendar-clock';
  import TrashIcon from '@lucide/svelte/icons/trash';
  import UserPlusIcon from '@lucide/svelte/icons/user-plus';
  import { DateTime } from 'luxon';
  import { InstanceDetail, isPaid, isRefunded } from './instance-detail.svelte';

  interface Props extends ModalProps {
    instanceId: string;
  }

  let { onClose, instanceId }: Props = $props();

  const instance = new InstanceDetail(
    () => instanceId,
    () => onClose(),
  );
</script>

{#snippet cancelClassFooter()}
  <Button variant="destructive" onclick={() => instance.cancelClass()}>
    <BanIcon />
    Cancel Class
  </Button>
{/snippet}

<Modal
  title={instance.instance?.catalog?.name ?? 'Class Details'}
  icon={CalendarIcon}
  {onClose}
  size="lg"
  footer={instance.scheduled ? cancelClassFooter : undefined}
>
  <QueryState query={instance.query} label="class">
    {#snippet children(detail)}
      {#if detail}
        <div class="flex flex-col gap-3">
          <Section title="Details">
            <dl>
              <InfoRow label="Date"
                >{DateTime.fromISO(detail.date).toFormat(DATE_FORMAT.SHORT_WEEKDAY_DATE)}</InfoRow
              >
              <InfoRow label="Time"
                >{formatTime(detail.startTime)} ({detail.durationMinutes}m)</InfoRow
              >
              <InfoRow label="Teacher">{detail.teacher?.name ?? detail.teacherEmail}</InfoRow>
              <InfoRow label="Seats">{instance.bookedSeats}/{detail.seats} booked</InfoRow>
              <InfoRow label="Status">
                <StatusBadge tone={instance.scheduled ? 'success' : 'danger'}>
                  {instance.scheduled ? 'Scheduled' : 'Canceled'}
                </StatusBadge>
              </InfoRow>
            </dl>
          </Section>

          {#if instance.scheduled}
            <Section title="Bookings">
              {#snippet actions()}
                {#if instance.openSeats > 0}
                  <Button size="sm" variant="ghost" onclick={() => instance.addBooking()}>
                    <UserPlusIcon />
                    Add Booking
                  </Button>
                {/if}
              {/snippet}
              {#if instance.confirmedBookings.length === 0}
                <p class="text-sm text-muted-foreground">No bookings yet.</p>
              {:else}
                <ul class="-my-1.5 divide-y">
                  {#each instance.confirmedBookings as booking (booking.id)}
                    <li class="flex items-center justify-between gap-3 py-1.5 text-sm">
                      <div class="min-w-0">
                        <div class="truncate font-medium">
                          {booking.customerName}{booking.quantity > 1
                            ? ` (x${booking.quantity})`
                            : ''}
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
                      <div class="flex shrink-0 gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onclick={() => instance.reschedule(booking)}
                          disabled={instance.isCanceling(booking)}
                        >
                          <CalendarClockIcon />
                          Reschedule
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          class="text-destructive hover:text-destructive"
                          onclick={() => instance.cancelBooking(booking)}
                          disabled={instance.isCanceling(booking)}
                        >
                          {#if instance.isCanceling(booking)}<Spinner />{:else}<TrashIcon />{/if}
                          {isPaid(booking) ? 'Cancel & Refund' : 'Cancel'}
                        </Button>
                      </div>
                    </li>
                  {/each}
                </ul>
              {/if}
            </Section>

            {#if instance.canceledBookings.length > 0}
              <Section title="Canceled Bookings">
                <ul class="flex flex-col gap-1 text-sm text-muted-foreground">
                  {#each instance.canceledBookings as booking (booking.id)}
                    <li>
                      {booking.customerName}{booking.quantity > 1 ? ` (x${booking.quantity})` : ''}
                      {#if isRefunded(booking)}
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
    {/snippet}
  </QueryState>
</Modal>
