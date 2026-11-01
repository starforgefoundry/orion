import type { User } from '$lib/server/db/schema';

export const STAFF_EMAIL_DOMAIN = '@starforgefoundry.com';

export function isStaffEmail(email: string | null | undefined): email is string {
  return !!email && email.endsWith(STAFF_EMAIL_DOMAIN);
}

/** Skips Google sign-in during local development. Never active in production builds. */
export function devLoginUser(isDev: boolean, email: string | undefined): User | undefined {
  if (!isDev || !email) return undefined;
  return { email, name: 'Dev User', picture: '', googleCalendarId: null };
}
