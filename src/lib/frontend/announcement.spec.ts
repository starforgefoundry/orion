import { announcementIsActive, expiryFromInputValue, expiryToInputValue } from './announcement';
import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

const now = DateTime.fromISO('2026-09-17T12:00:00Z');

describe('announcementIsActive', () => {
  it('hides an empty announcement', () => {
    expect(announcementIsActive('   ', '', now)).toBe(false);
  });

  it('shows an announcement with no expiry', () => {
    expect(announcementIsActive('Delays this week', '', now)).toBe(true);
  });

  it('shows an announcement before its expiry', () => {
    expect(announcementIsActive('Delays this week', '2026-09-17T12:00:01Z', now)).toBe(true);
  });

  it('hides an announcement once its expiry passes', () => {
    expect(announcementIsActive('Delays this week', '2026-09-17T11:59:59Z', now)).toBe(false);
  });
});

describe('expiry input conversion', () => {
  it('round trips a local datetime through storage', () => {
    const stored = expiryFromInputValue('2026-09-20T17:30');

    expect(expiryToInputValue(stored)).toBe('2026-09-20T17:30');
  });

  it('treats unparseable values as no expiry', () => {
    expect(expiryFromInputValue('')).toBe('');
    expect(expiryToInputValue('not a date')).toBe('');
  });
});
