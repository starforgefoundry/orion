import { DateTime } from 'luxon';
import { generateKeyPairSync, verify } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { PASS_KIND } from '$lib/member_enums';
import type { PassDetails } from './pass_details';
import {
  GOOGLE_WALLET_SAVE_URL,
  googleWalletClaims,
  googleWalletSaveUrl,
  type GoogleWalletConfig,
} from './google_wallet';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });

const CONFIG: GoogleWalletConfig = {
  issuerId: '3388000000012345678',
  classSuffix: 'member_pass',
  serviceAccountEmail: 'wallet@project.iam.gserviceaccount.com',
  privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  origin: 'https://orion.example.com',
};

const MEMBER: PassDetails = {
  kind: PASS_KIND.MEMBERSHIP,
  title: 'Membership',
  serial: 'member-1',
  passToken: 'token-abc',
  holderLabel: 'Member',
  holderName: 'Sam Smith',
  fields: [{ key: 'memberSince', label: 'Member since', value: 'Feb 2026' }],
};

function decodeSegment(segment: string) {
  return JSON.parse(Buffer.from(segment, 'base64url').toString());
}

describe('googleWalletClaims', () => {
  it('embeds the generic class and an object whose QR opens the member pass', () => {
    const claims = googleWalletClaims(MEMBER, CONFIG, new Date('2026-10-16T12:00:00Z'));

    expect(claims).toMatchObject({
      iss: CONFIG.serviceAccountEmail,
      aud: 'google',
      typ: 'savetowallet',
      iat: 1792152000,
      origins: [CONFIG.origin],
      payload: {
        genericClasses: [{ id: '3388000000012345678.member_pass' }],
        genericObjects: [
          {
            id: '3388000000012345678.member-1',
            classId: '3388000000012345678.member_pass',
            state: 'ACTIVE',
            header: { defaultValue: { language: 'en-US', value: 'Sam Smith' } },
            subheader: { defaultValue: { language: 'en-US', value: 'Membership' } },
            hexBackgroundColor: '#0e1630',
            heroImage: { sourceUri: { uri: 'https://orion.example.com/wallet/pass-hero.jpg' } },
            textModulesData: expect.arrayContaining([
              { id: 'memberSince', header: 'Member since', body: 'Feb 2026' },
            ]),
            barcode: { type: 'QR_CODE', value: 'https://orion.example.com/pass/token-abc' },
          },
        ],
      },
    });
    expect(claims.payload.genericObjects[0].validTimeInterval).toBeUndefined();
  });

  it('labels booking passes by type and stops them being valid after they end', () => {
    const expiresAt = DateTime.fromISO('2026-10-20T20:00:00Z');
    const claims = googleWalletClaims(
      {
        ...MEMBER,
        kind: PASS_KIND.CAR_BAY,
        title: 'Car Bay Pass',
        serial: 'car_bay-token-xyz',
        expiresAt,
      },
      CONFIG,
    );

    expect(claims.payload.genericObjects[0]).toMatchObject({
      id: '3388000000012345678.car_bay-token-xyz',
      subheader: { defaultValue: { language: 'en-US', value: 'Car Bay Pass' } },
      validTimeInterval: { end: { date: expiresAt.toISO() } },
    });
  });
});

describe('googleWalletSaveUrl', () => {
  it('returns a save link carrying an RS256 JWT signed by the service account key', () => {
    const url = googleWalletSaveUrl(MEMBER, CONFIG);
    expect(url.startsWith(`${GOOGLE_WALLET_SAVE_URL}/`)).toBe(true);

    const [header, payload, signature] = url.slice(GOOGLE_WALLET_SAVE_URL.length + 1).split('.');
    expect(decodeSegment(header)).toEqual({ alg: 'RS256', typ: 'JWT' });
    expect(decodeSegment(payload).payload.genericObjects[0].id).toBe(
      '3388000000012345678.member-1',
    );
    expect(
      verify(
        'sha256',
        Buffer.from(`${header}.${payload}`),
        publicKey,
        Buffer.from(signature, 'base64url'),
      ),
    ).toBe(true);
  });
});
