import { PASS_KIND, type PassKind } from '$lib/member_enums';
import type { IssuedPass } from '$lib/server/repositories/pass.repository';
import { memberSince } from '$lib/server/utils/pass_brand';
import { SPACE_ZONE } from '$lib/space';
import { CAR_BAY_TIER_NAMES, formatPeriod } from '$lib/utils/car_bay';
import { classEndsAt, classStartsAt } from '$lib/utils/classes';
import { DateTime } from 'luxon';

const DATE_FORMAT = 'EEEE, MMMM d, yyyy';
const SHORT_DATE_FORMAT = 'MMM d, yyyy';
const TIME_FORMAT = 'h:mm a';

export const PASS_TITLES: Record<PassKind, string> = {
  [PASS_KIND.MEMBERSHIP]: 'Membership',
  [PASS_KIND.DAY_PASS]: 'Day Pass',
  [PASS_KIND.CLASS]: 'Class Pass',
  [PASS_KIND.CAR_BAY]: 'Car Bay Pass',
};

export type PassField = { key: string; label: string; value: string };

export type PassDetails = {
  kind: PassKind;
  title: string;
  /** Identifies the pass inside Apple and Google Wallet. */
  serial: string;
  passToken: string;
  holderLabel: string;
  holderName: string;
  fields: PassField[];
  /** When the wallet should bring the pass up on the lock screen. */
  relevantDate?: DateTime;
  expiresAt?: DateTime;
};

function spaceDay(date: DateTime, format = DATE_FORMAT) {
  return date.setZone(SPACE_ZONE).toFormat(format);
}

export function passDetails(pass: IssuedPass): PassDetails {
  const common = { kind: pass.kind, title: PASS_TITLES[pass.kind], passToken: pass.passToken };

  switch (pass.kind) {
    case PASS_KIND.MEMBERSHIP:
      return {
        ...common,
        // Matches the serial on passes issued before other pass types existed.
        serial: pass.member.id,
        holderLabel: 'Member',
        holderName: pass.member.name,
        fields: [{ key: 'memberSince', label: 'Member since', value: memberSince(pass.member) }],
      };

    case PASS_KIND.DAY_PASS:
      return {
        ...common,
        serial: `${pass.kind}-${pass.passToken}`,
        holderLabel: 'Guest',
        holderName: pass.member.name,
        fields: [
          {
            key: 'purchased',
            label: 'Purchased',
            value: spaceDay(pass.dayPass.purchasedDate, SHORT_DATE_FORMAT),
          },
        ],
      };

    case PASS_KIND.CLASS: {
      const startsAt = classStartsAt(pass.instance);
      return {
        ...common,
        serial: `${pass.kind}-${pass.passToken}`,
        holderLabel: 'Attendee',
        holderName: pass.booking.customerName,
        fields: [
          { key: 'class', label: 'Class', value: pass.catalog.name },
          { key: 'date', label: 'Date', value: spaceDay(startsAt) },
          { key: 'time', label: 'Time', value: startsAt.toFormat(TIME_FORMAT) },
          { key: 'spots', label: 'Spots', value: pass.booking.quantity.toString() },
        ],
        relevantDate: startsAt,
        expiresAt: classEndsAt(pass.instance),
      };
    }

    case PASS_KIND.CAR_BAY:
      return {
        ...common,
        serial: `${pass.kind}-${pass.passToken}`,
        holderLabel: 'Booked by',
        holderName: pass.booking.customerName,
        fields: [
          { key: 'tier', label: 'Booking', value: CAR_BAY_TIER_NAMES[pass.booking.tier] },
          { key: 'when', label: 'When', value: formatPeriod(pass.booking) },
        ],
        relevantDate: pass.booking.startAt,
        expiresAt: pass.booking.endAt,
      };
  }
}
