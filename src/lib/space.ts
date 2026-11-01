import type { DateTime } from 'luxon';

export const SPACE_ZONE = 'America/Chicago';

/** The calendar day (YYYY-MM-DD) it is at the space at `now`. */
export function spaceDate(now: DateTime) {
  return now.setZone(SPACE_ZONE).toISODate()!;
}
