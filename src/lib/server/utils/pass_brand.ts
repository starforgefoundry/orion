import type { Member } from '$lib/server/db/schema';
import { SPACE_ZONE } from '$lib/server/utils/member_access';

type Rgb = [number, number, number];

export const PASS_BRAND = {
  navy: [14, 22, 48] as Rgb,
  gold: [242, 196, 70] as Rgb,
  white: [255, 255, 255] as Rgb,
  website: 'https://starforgefoundry.com',
  contactEmail: 'contact@starforgefoundry.com',
  checkInInstructions:
    'Hold the QR code up to the iPad at the front desk when you arrive. You need a signed waiver on file before your first visit.',
};

const MEMBER_SINCE_FORMAT = 'LLL yyyy';

export function hexColor([r, g, b]: Rgb) {
  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

export function memberSince(member: Pick<Member, 'createdDate'>) {
  return member.createdDate.setZone(SPACE_ZONE).toFormat(MEMBER_SINCE_FORMAT);
}
