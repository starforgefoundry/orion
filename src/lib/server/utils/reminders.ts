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

/** Marks one reminder sent, or gives it back after a failed send. */
export type ReminderClaim = {
  /** Resolves false when another sweep already sent it. */
  claim: () => Promise<boolean>;
  release: () => Promise<unknown>;
};

/**
 * Sends a reminder at most once, even when sweeps overlap or run on several app instances. The
 * reminder is marked sent before the email goes out, and a failed send is given back for the next
 * sweep to retry.
 */
export async function sendOnce(reminder: ReminderClaim, send: () => Promise<unknown>) {
  if (!(await reminder.claim())) return false;
  try {
    await send();
  } catch (error) {
    await reminder.release();
    throw error;
  }
  return true;
}
