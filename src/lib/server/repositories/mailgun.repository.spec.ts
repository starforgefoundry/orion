import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import { retryAfter } from './mailgun.repository';

describe('retryAfter', () => {
  it('reads the reset time from the Mailgun limit message', () => {
    const retryAt = retryAfter(
      'Domain starforgefoundry.com is not allowed to send: recipient limit (26) exceeded, try again after Thu, 22 Oct 2026 00:27:54 UTC',
    );

    expect(retryAt.toUTC().toISO()).toBe('2026-10-22T00:27:54.000Z');
  });

  it('waits a minute when the message has no reset time', () => {
    const retryAt = retryAfter('Too many requests');

    expect(retryAt.diffNow().as('seconds')).toBeCloseTo(60, 0);
  });
});
