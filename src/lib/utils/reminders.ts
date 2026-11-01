import type { DateTime, Duration } from 'luxon';

export type RemindableBooking = { startsAt: DateTime; bookedAt: DateTime };

/** Bookings made inside the lead time are skipped, since their confirmation just went out. */
export function dueForReminder(booking: RemindableBooking, now: DateTime, lead: Duration) {
  const { startsAt, bookedAt } = booking;
  return (
    startsAt > now &&
    startsAt <= now.plus(lead) &&
    startsAt.diff(bookedAt).toMillis() > lead.toMillis()
  );
}
