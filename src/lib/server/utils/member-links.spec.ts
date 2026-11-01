import { describe, expect, it } from 'vitest';
import { onboardingUrl, PASS_PATH, passLinks, passTokenFromScan } from './member-links';

const FRONTEND_URL = 'https://orion.example.com';
const TOKEN = 'pass-token';

describe(passTokenFromScan.name, () => {
  it.each([
    ['a bare token', TOKEN],
    ['a token with whitespace', `  ${TOKEN}\n`],
    ['a pass URL', `${FRONTEND_URL}${PASS_PATH}/${TOKEN}`],
    ['a pass URL with a query', `${FRONTEND_URL}${PASS_PATH}/${TOKEN}?ref=qr`],
    ['a pass URL with a fragment', `${FRONTEND_URL}${PASS_PATH}/${TOKEN}#top`],
  ])('reads the token from %s', (_, scanned) => {
    expect(passTokenFromScan(scanned)).toBe(TOKEN);
  });
});

describe(passLinks.name, () => {
  it('links the pass page and its QR image', () => {
    expect(passLinks({ passToken: TOKEN })).toEqual({
      passUrl: `${FRONTEND_URL}${PASS_PATH}/${TOKEN}`,
      passQrImageUrl: `${FRONTEND_URL}/api${PASS_PATH}/${TOKEN}/qr`,
    });
  });
});

describe(onboardingUrl.name, () => {
  it('uses the onboarding token rather than the pass token', () => {
    expect(onboardingUrl({ onboardingToken: 'onboarding-token' })).toBe(
      `${FRONTEND_URL}/member/onboard/onboarding-token`,
    );
  });
});
