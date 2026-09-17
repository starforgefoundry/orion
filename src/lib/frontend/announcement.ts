import { DateTime } from 'luxon';

const DATETIME_LOCAL_FORMAT = "yyyy-MM-dd'T'HH:mm";

export function announcementIsActive(
  announcement: string,
  expiresAt: string,
  now: DateTime = DateTime.now(),
): boolean {
  if (!announcement.trim()) {
    return false;
  }

  const expiry = DateTime.fromISO(expiresAt);

  return !expiry.isValid || now < expiry;
}

export function expiryToInputValue(expiresAt: string): string {
  const expiry = DateTime.fromISO(expiresAt);

  return expiry.isValid ? expiry.toLocal().toFormat(DATETIME_LOCAL_FORMAT) : '';
}

export function expiryFromInputValue(inputValue: string): string {
  const expiry = DateTime.fromFormat(inputValue, DATETIME_LOCAL_FORMAT);

  return expiry.isValid ? expiry.toUTC().toISO() : '';
}
