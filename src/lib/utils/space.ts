import type { DateTime } from 'luxon';

export const SPACE_ZONE = 'America/Chicago';

/** The calendar day (YYYY-MM-DD) it is at the space at `now`. */
export function spaceDate(now: DateTime) {
  return now.setZone(SPACE_ZONE).toISODate()!;
}

export const SPACE_NAME = 'Starforge Foundry';
export const SPACE_DOMAIN = 'starforgefoundry.com';

export const SPACE_EMAIL = {
  CONTACT: `contact@${SPACE_DOMAIN}`,
  CLASSES: `classes@${SPACE_DOMAIN}`,
  CAR_BAY: `carbay@${SPACE_DOMAIN}`,
  PRINTS: `3dprint@${SPACE_DOMAIN}`,
} as const;
