import type { SelectOption } from '$lib/frontend/components/form/OptionSelect.svelte';
import { submitWithToast } from '$lib/frontend/form-submit';
import { formatTime } from '$lib/frontend/utils';
import { rescheduleBookingStaff } from '$lib/remotes/endpoints/class.remote';
import type { ClassBooking, ClassInstance } from '$lib/server/db/schema';
import { CLASS_INSTANCE_STATUS, classHasStarted, classStartsAt } from '$lib/utils/classes';

type Session = ClassInstance & { confirmedCount: number };

export type ReschedulableBooking = Pick<
  ClassBooking,
  'id' | 'instanceId' | 'customerName' | 'quantity'
>;

export class BookingReschedule {
  targetInstanceId = $state('');
  submitting = $state(false);

  #booking: ReschedulableBooking;
  #classId: string;

  constructor(booking: ReschedulableBooking, classId: string) {
    this.#booking = booking;
    this.#classId = classId;
  }

  options(sessions: Session[]): SelectOption[] {
    return sessions
      .filter(
        (session) =>
          session.classId === this.#classId &&
          session.id !== this.#booking.instanceId &&
          session.status === CLASS_INSTANCE_STATUS.SCHEDULED &&
          session.seats - session.confirmedCount >= this.#booking.quantity &&
          !classHasStarted(session),
      )
      .sort((a, b) => classStartsAt(a).toMillis() - classStartsAt(b).toMillis())
      .map((session) => ({
        value: session.id,
        label: `${classStartsAt(session).toFormat('EEE, MMM d, yyyy')} · ${formatTime(session.startTime)} (${session.seats - session.confirmedCount} open)`,
      }));
  }

  get canSubmit() {
    return this.targetInstanceId !== '';
  }

  async submit() {
    this.submitting = true;
    const ok = await submitWithToast(
      () =>
        rescheduleBookingStaff({
          bookingId: this.#booking.id,
          targetInstanceId: this.targetInstanceId,
        }),
      { success: 'Booking rescheduled', error: 'Failed to reschedule booking' },
    );
    this.submitting = false;
    return ok;
  }
}
