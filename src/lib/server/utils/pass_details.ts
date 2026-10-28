import { PASS_KIND, type PassKind } from '$lib/member_enums';
import type { IssuedPass } from '$lib/server/repositories/pass.repository';
import { memberSince } from '$lib/server/utils/pass_brand';
import { SPACE_ZONE } from '$lib/space';
import { CAR_BAY_TIER_NAMES, formatPeriod } from '$lib/utils/car_bay';
import { CLASS_DATE_FORMAT, classEndsAt, classStartsAt, formatClassTime } from '$lib/utils/classes';
import { DateTime } from 'luxon';

const SHORT_DATE_FORMAT = 'MMM d, yyyy';

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

export function passDetails(pass: IssuedPass): PassDetails {
  const common = {
    kind: pass.kind,
    title: PASS_TITLES[pass.kind],
    passToken: pass.passToken,
    serial: `${pass.kind}-${pass.passToken}`,
  };

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
        holderLabel: 'Guest',
        holderName: pass.member.name,
        fields: [
          {
            key: 'purchased',
            label: 'Purchased',
            value: pass.dayPass.purchasedDate.setZone(SPACE_ZONE).toFormat(SHORT_DATE_FORMAT),
          },
        ],
      };

    case PASS_KIND.CLASS: {
      const startsAt = classStartsAt(pass.instance);
      return {
        ...common,
        holderLabel: 'Attendee',
        holderName: pass.booking.customerName,
        fields: [
          { key: 'class', label: 'Class', value: pass.catalog.name },
          { key: 'date', label: 'Date', value: startsAt.toFormat(CLASS_DATE_FORMAT) },
          { key: 'time', label: 'Time', value: formatClassTime(pass.instance) },
          { key: 'spots', label: 'Spots', value: pass.booking.quantity.toString() },
        ],
        relevantDate: startsAt,
        expiresAt: classEndsAt(pass.instance),
      };
    }

    case PASS_KIND.CAR_BAY:
      return {
        ...common,
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
