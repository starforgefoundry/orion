import { DateTime, Settings } from 'luxon';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DATE_STYLE, formatBytes, formatDate, formatDateTime, formatIsoDate } from './format';

const date = () => DateTime.fromISO('2026-10-14T18:30:00');

describe('date formatting', () => {
  let locale: string;

  beforeEach(() => {
    locale = Settings.defaultLocale;
    Settings.defaultLocale = 'en-US';
  });

  afterEach(() => {
    Settings.defaultLocale = locale;
  });

  it('formats dates in the medium style by default', () => {
    expect(formatDate(date())).toBe('Oct 14, 2026');
    expect(formatDate(date(), DATE_STYLE.SHORT)).toBe('10/14/2026');
    expect(formatDate(date(), DATE_STYLE.FULL)).toBe('October 14, 2026');
  });

  it('shows a dash for missing dates', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatIsoDate(undefined)).toBe('—');
  });

  it('formats ISO date strings', () => {
    expect(formatIsoDate('2026-10-14')).toBe('Oct 14, 2026');
  });

  it('formats a date with its time', () => {
    expect(formatDateTime(date())).toBe('Oct 14, 2026, 6:30 PM');
  });
});

describe('formatBytes', () => {
  let locale: string;

  beforeEach(() => {
    locale = Settings.defaultLocale;
    Settings.defaultLocale = 'en-US';
  });

  afterEach(() => {
    Settings.defaultLocale = locale;
  });

  it('pluralizes bytes and abbreviates larger units', () => {
    expect(formatBytes(1)).toBe('1 byte');
    expect(formatBytes(6)).toBe('6 bytes');
    expect(formatBytes(1536)).toBe('1.5 kB');
    expect(formatBytes(1.5 * 1024 ** 2)).toBe('1.5 MB');
  });
});
