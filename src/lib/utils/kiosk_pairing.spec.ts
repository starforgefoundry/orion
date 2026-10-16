import { describe, expect, it } from 'vitest';
import { kioskPairPathFromScan } from './kiosk_pairing';

const ORIGIN = 'https://orion.example.com';

describe('kioskPairPathFromScan', () => {
  it('accepts a same-origin pairing link', () => {
    expect(kioskPairPathFromScan(`${ORIGIN}/kiosk/pair?token=abc_123`, ORIGIN)).toBe(
      '/kiosk/pair?token=abc_123',
    );
  });

  it('drops extra query params and fragments', () => {
    expect(kioskPairPathFromScan(`${ORIGIN}/kiosk/pair?token=abc&next=/evil#x`, ORIGIN)).toBe(
      '/kiosk/pair?token=abc',
    );
  });

  it('rejects links to another origin', () => {
    expect(kioskPairPathFromScan('https://evil.example.com/kiosk/pair?token=abc', ORIGIN)).toBe(
      null,
    );
  });

  it('rejects other paths on the same origin', () => {
    expect(kioskPairPathFromScan(`${ORIGIN}/pass/abc`, ORIGIN)).toBe(null);
  });

  it('rejects a pairing link without a token', () => {
    expect(kioskPairPathFromScan(`${ORIGIN}/kiosk/pair`, ORIGIN)).toBe(null);
  });

  it('rejects text that is not a URL', () => {
    expect(kioskPairPathFromScan('not a url', ORIGIN)).toBe(null);
  });
});
