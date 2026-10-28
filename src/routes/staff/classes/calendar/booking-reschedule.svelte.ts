import type { SelectOption } from '$lib/frontend/components/form/OptionSelect.svelte';
import { formatTime } from '$lib/frontend/utils';
import { rescheduleBookingStaff } from '$lib/remotes/endpoints/class.remote';
import type { ClassInstance } from '$lib/server/db/schema';
import { SPACE_ZONE } from '$lib/space';
import { CLASS_INSTANCE_STATUS } from '$lib/utils/classes';
import { DateTime } from 'luxon';

type Session = ClassInstance & { confirmedCount: number };

type RescheduledBooking = {
  id: string;
  instanceId: string;
  classId: string;
  quantity: number;
};

function startOf(session: Session) {
  return DateTime.fromISO(`${session.date}T${session.startTime}`, { zone: SPACE_ZONE });
}

export class BookingReschedule {
  targetInstanceId = $state('');

  #booking: RescheduledBooking;

  constructor(booking: RescheduledBooking) {
    this.#booking = booking;
  }

  options(sessions: Session[]): SelectOption[] {
    const now = DateTime.now().setZone(SPACE_ZONE);
    return sessions
      .filter(
        (session) =>
          session.classId === this.#booking.classId &&
          session.id !== this.#booking.instanceId &&
          session.status === CLASS_INSTANCE_STATUS.SCHEDULED &&
          session.seats - session.confirmedCount >= this.#booking.quantity &&
          startOf(session) > now,
      )
      .sort((a, b) => startOf(a).toMillis() - startOf(b).toMillis())
      .map((session) => ({
        value: session.id,
        label: `${startOf(session).toFormat('EEE, MMM d, yyyy')} · ${formatTime(session.startTime)} (${session.seats - session.confirmedCount} open)`,
      }));
  }

  get canSubmit() {
    return this.targetInstanceId !== '';
  }

  async submit() {
    return await rescheduleBookingStaff({
      bookingId: this.#booking.id,
      targetInstanceId: this.targetInstanceId,
    });
  }
}
