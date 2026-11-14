import { DateTime, type DateTimeFormatOptions } from 'luxon';

const MISSING = '—';
const BYTES_PER_UNIT = 1024;
const BYTE_UNITS = ['byte', 'kilobyte', 'megabyte', 'gigabyte'] as const;

export function formatBytes(bytes: number) {
  const exponent =
    bytes > 0
      ? Math.min(Math.floor(Math.log(bytes) / Math.log(BYTES_PER_UNIT)), BYTE_UNITS.length - 1)
      : 0;
  return new Intl.NumberFormat(undefined, {
    style: 'unit',
    unit: BYTE_UNITS[exponent],
    unitDisplay: exponent === 0 ? 'long' : 'short',
    maximumFractionDigits: 1,
  }).format(bytes / BYTES_PER_UNIT ** exponent);
}

/** Locale-aware formats for `formatDate`. */
export const DATE_STYLE = {
  /** 10/14/2026 */
  SHORT: DateTime.DATE_SHORT,
  /** Oct 14, 2026 */
  MEDIUM: DateTime.DATE_MED,
  /** October 14, 2026 */
  FULL: DateTime.DATE_FULL,
} as const satisfies Record<string, DateTimeFormatOptions>;

/** Luxon `toFormat` patterns. */
export const DATE_FORMAT = {
  /** Wed */
  SHORT_WEEKDAY: 'EEE',
  /** Wednesday */
  WEEKDAY: 'EEEE',
  /** Oct 14 */
  MONTH_DAY: 'MMM d',
  /** Oct 14, 2026 */
  MONTH_DAY_YEAR: 'MMM d, yyyy',
  /** Oct 14, 6:30 PM */
  MONTH_DAY_TIME: 'MMM d, h:mm a',
  /** Wednesday, October 14 */
  WEEKDAY_MONTH_DAY: 'EEEE, MMMM d',
  /** Wed, Oct 14, 2026 */
  SHORT_WEEKDAY_DATE: 'EEE, MMM d, yyyy',
  /** October 2026 */
  MONTH_YEAR: 'MMMM yyyy',
} as const;

/** 6:30 PM */
export const TIME_FORMAT = 'h:mm a';

/** 6 PM */
export const HOUR_FORMAT = 'h a';

export function formatDate(
  date: DateTime | null | undefined,
  style: DateTimeFormatOptions = DATE_STYLE.MEDIUM,
) {
  return date ? date.toLocaleString(style) : MISSING;
}

export function formatDateTime(date: DateTime) {
  return date.toLocaleString(DateTime.DATETIME_MED);
}

/** For ISO strings, such as YYYY-MM-DD columns, which have no time zone. */
export function formatIsoDate(
  date: string | null | undefined,
  style: DateTimeFormatOptions = DATE_STYLE.MEDIUM,
) {
  return date ? DateTime.fromISO(date).toLocaleString(style) : MISSING;
}
