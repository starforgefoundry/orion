import { describe, expect, it } from 'vitest';
import { devLoginUser, isStaffEmail, STAFF_EMAIL_DOMAIN } from './staff';

const DEV_EMAIL = `dev${STAFF_EMAIL_DOMAIN}`;

describe(isStaffEmail.name, () => {
  it('accepts a staff address', () => {
    expect(isStaffEmail(`ada${STAFF_EMAIL_DOMAIN}`)).toBe(true);
  });

  it.each([
    ['a missing email', undefined],
    ['an empty email', ''],
    ['another domain', 'ada@gmail.com'],
    ['a domain that only ends with the staff name', 'ada@notstarforgefoundry.com'],
    ['the staff domain as a subdomain', `ada${STAFF_EMAIL_DOMAIN}.evil.com`],
  ])('rejects %s', (_, email) => {
    expect(isStaffEmail(email)).toBe(false);
  });
});

describe(devLoginUser.name, () => {
  it('signs in the configured user in development', () => {
    expect(devLoginUser(true, DEV_EMAIL)).toMatchObject({ email: DEV_EMAIL });
  });

  it('never signs anyone in outside development', () => {
    expect(devLoginUser(false, DEV_EMAIL)).toBeUndefined();
  });

  it('signs no one in when no email is configured', () => {
    expect(devLoginUser(true, undefined)).toBeUndefined();
  });
});
