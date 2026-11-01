import { errorDescription } from '$lib/frontend/form-submit';
import { modalManager } from '$lib/frontend/modal-manager.svelte';
import type { CancelInstanceDto } from '$lib/remotes/dtos/class.dto';
import {
  cancelBookingStaff,
  cancelInstance,
  getAllInstances,
  getInstanceDetail,
} from '$lib/remotes/endpoints/class.remote';
import { PAYMENT_STATUS } from '$lib/utils/billing';
import { CLASS_BOOKING_STATUS, CLASS_INSTANCE_STATUS } from '$lib/utils/classes';
import { toast } from 'svelte-sonner';
import AddBookingModal from './AddBookingModal.svelte';
import CancelClassModal from './CancelClassModal.svelte';
import RescheduleBookingModal from './RescheduleBookingModal.svelte';

const DEFAULT_BOOKING_QUANTITY = 1;

type ClassInstanceDetail = NonNullable<Awaited<ReturnType<typeof getInstanceDetail>>>;
export type InstanceBooking = ClassInstanceDetail['bookings'][number];

export function isPaid(booking: InstanceBooking) {
  return booking.payment?.status === PAYMENT_STATUS.PAID && booking.payment.total > 0;
}

export function isRefunded(booking: InstanceBooking) {
  return booking.payment?.status === PAYMENT_STATUS.REFUNDED;
}

export class InstanceDetail {
  /** The booking being canceled, so its buttons can show progress. */
  cancelingBookingId = $state<string | null>(null);

  readonly query = $derived(getInstanceDetail(this.instanceId));

  private getInstanceId: () => string;
  private onCanceled: () => void;

  constructor(getInstanceId: () => string, onCanceled: () => void) {
    this.getInstanceId = getInstanceId;
    this.onCanceled = onCanceled;
  }

  get instanceId() {
    return this.getInstanceId();
  }

  get instance() {
    return this.query.current;
  }

  get scheduled() {
    return this.instance?.status === CLASS_INSTANCE_STATUS.SCHEDULED;
  }

  get confirmedBookings() {
    return this.bookingsWith(CLASS_BOOKING_STATUS.CONFIRMED);
  }

  get canceledBookings() {
    return this.bookingsWith(CLASS_BOOKING_STATUS.CANCELED);
  }

  get bookedSeats() {
    return this.confirmedBookings.reduce(
      (sum, booking) => sum + (booking.quantity ?? DEFAULT_BOOKING_QUANTITY),
      0,
    );
  }

  get openSeats() {
    return (this.instance?.seats ?? 0) - this.bookedSeats;
  }

  isCanceling(booking: InstanceBooking) {
    return this.cancelingBookingId === booking.id;
  }

  async cancelBooking(booking: InstanceBooking) {
    const refund = isPaid(booking);
    const confirmed = await modalManager.confirm({
      title: 'Cancel Booking',
      prompt: refund
        ? 'Cancel this booking and issue a full refund?'
        : 'Cancel this booking? No refund will be issued.',
      confirmText: refund ? 'Cancel & Refund' : 'Cancel Booking',
      variant: 'destructive',
    });
    if (!confirmed) return;

    this.cancelingBookingId = booking.id;
    try {
      await cancelBookingStaff({ bookingId: booking.id });
    } catch (error) {
      toast.error('Failed to cancel booking', { description: errorDescription(error) });
    } finally {
      this.cancelingBookingId = null;
    }
  }

  addBooking() {
    const instanceId = this.instanceId;
    modalManager.show(AddBookingModal, {
      instanceId,
      availableSpots: this.openSeats,
      onBookingCreated: async () => {
        await getInstanceDetail(instanceId).refresh();
        await getAllInstances().refresh();
      },
    });
  }

  reschedule(booking: InstanceBooking) {
    if (!this.instance) return;
    modalManager.show(RescheduleBookingModal, { booking, classId: this.instance.classId });
  }

  cancelClass() {
    const instanceId = this.instanceId;
    modalManager.show(CancelClassModal, {
      hasRecurrenceGroup: !!this.instance?.recurrenceGroupId,
      onConfirm: async (mode: CancelInstanceDto['mode']) => {
        try {
          const { canceledCount } = await cancelInstance({ instanceId, mode });
          toast.success(`Canceled ${canceledCount} class${canceledCount !== 1 ? 'es' : ''}`);
          this.onCanceled();
        } catch (error) {
          toast.error('Failed to cancel', { description: errorDescription(error) });
        }
      },
    });
  }

  private bookingsWith(status: InstanceBooking['status']) {
    return this.instance?.bookings?.filter((booking) => booking.status === status) ?? [];
  }
}
