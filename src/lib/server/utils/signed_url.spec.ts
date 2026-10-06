import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
  env: { FILE_SIGNING_SECRET: 'test-secret' },
}));

import { signUrl, verifySignedUrl } from './signed_url';

const BASE_URL = 'https://orion.test';
const HOURS = 60 * 60 * 1000;

function signed(path: string) {
  return new URL(signUrl(path), BASE_URL);
}

afterEach(() => {
  vi.useRealTimers();
});

describe('verifySignedUrl', () => {
  it('accepts a freshly signed url', () => {
    expect(verifySignedUrl(signed('/api/prints/download/req-1'))).toBe(true);
  });

  it('rejects a signature reused on another path', () => {
    const url = signed('/api/prints/download/req-1');
    url.pathname = '/api/prints/download/req-2';

    expect(verifySignedUrl(url)).toBe(false);
  });

  it('rejects a tampered expiry', () => {
    const url = signed('/files/waivers/jane');
    url.searchParams.set('expires', String(Number(url.searchParams.get('expires')) + 1));

    expect(verifySignedUrl(url)).toBe(false);
  });

  it('rejects expired links', () => {
    const url = signed('/files/waivers/jane');
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 13 * HOURS);

    expect(verifySignedUrl(url)).toBe(false);
  });

  it('rejects unsigned urls', () => {
    expect(verifySignedUrl(new URL('/files/waivers/jane', BASE_URL))).toBe(false);
  });
});
