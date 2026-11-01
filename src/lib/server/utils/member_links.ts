import { env } from '$env/dynamic/private';
import type { Member } from '$lib/server/db/schema';

export const PASS_PATH = '/pass';
export const ONBOARDING_PATH = '/member/onboard';
export const CAR_BAY_BOOKING_PATH = '/car_bay/booking';
export const CLASS_BOOKING_PATH = '/classes/booking';

/** The value encoded in a pass's QR code. Phone cameras open it; the kiosk reads the token. */
export function passUrl(pass: { passToken: string }) {
  return `${env.FRONTEND_URL}${PASS_PATH}/${pass.passToken}`;
}

/** A QR image email clients can load, since most of them block inline images. */
export function passQrImageUrl(pass: { passToken: string }) {
  return `${env.FRONTEND_URL}/api${PASS_PATH}/${pass.passToken}/qr`;
}

export function passLinks(pass: { passToken: string }) {
  return { passUrl: passUrl(pass), passQrImageUrl: passQrImageUrl(pass) };
}

export function passTokenFromScan(scanned: string) {
  const trimmed = scanned.trim();
  const prefix = `${PASS_PATH}/`;
  const index = trimmed.lastIndexOf(prefix);
  return index === -1 ? trimmed : trimmed.slice(index + prefix.length).split(/[?#]/)[0];
}

/** Uses its own token so scanning someone's QR code never reveals their email or waiver form. */
export function onboardingUrl(member: Pick<Member, 'onboardingToken'>) {
  return `${env.FRONTEND_URL}${ONBOARDING_PATH}/${member.onboardingToken}`;
}

export function carBayBookingUrl(booking: { bookingToken: string }) {
  return `${env.FRONTEND_URL}${CAR_BAY_BOOKING_PATH}/${booking.bookingToken}`;
}

export function classBookingUrl(booking: { bookingToken: string }) {
  return `${env.FRONTEND_URL}${CLASS_BOOKING_PATH}/${booking.bookingToken}`;
}
