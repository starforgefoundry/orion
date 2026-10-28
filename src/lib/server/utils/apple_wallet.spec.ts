import { DateTime } from 'luxon';
import { PKPass } from 'passkit-generator';
import { describe, expect, it, vi } from 'vitest';
import { PASS_KIND } from '$lib/member_enums';
import { applePassJson, buildApplePass, type AppleWalletConfig } from './apple_wallet';
import type { PassDetails } from './pass_details';

vi.mock('passkit-generator', () => ({
  PKPass: vi.fn(
    class {
      getAsBuffer = vi.fn(() => Buffer.from('pkpass'));
    },
  ),
}));

const CONFIG: AppleWalletConfig = {
  passTypeId: 'pass.com.starforgefoundry.member',
  teamId: 'ABCDE12345',
  signerCert: 'signer-cert',
  signerKey: 'signer-key',
  signerKeyPassphrase: 'secret',
  wwdr: 'wwdr-cert',
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

const CLASS_STARTS_AT = DateTime.fromISO('2026-10-20T18:00:00Z');

const CLASS_PASS: PassDetails = {
  kind: PASS_KIND.CLASS,
  title: 'Class Pass',
  serial: 'class-token-def',
  passToken: 'token-def',
  holderLabel: 'Attendee',
  holderName: 'Sam Smith',
  fields: [
    { key: 'class', label: 'Class', value: 'Intro to Welding' },
    { key: 'time', label: 'Time', value: '1:00 PM' },
  ],
  relevantDate: CLASS_STARTS_AT,
  expiresAt: CLASS_STARTS_AT.plus({ hours: 2 }),
};

describe('applePassJson', () => {
  it('builds a store card whose QR opens the member pass', () => {
    expect(applePassJson(MEMBER, CONFIG)).toMatchObject({
      formatVersion: 1,
      passTypeIdentifier: 'pass.com.starforgefoundry.member',
      teamIdentifier: 'ABCDE12345',
      serialNumber: 'member-1',
      organizationName: 'Starforge Foundry',
      storeCard: {
        headerFields: [{ key: 'kind', label: 'Pass', value: 'Membership' }],
        secondaryFields: [
          { key: 'holder', label: 'Member', value: 'Sam Smith' },
          { key: 'memberSince', label: 'Member since', value: 'Feb 2026' },
        ],
      },
      barcodes: [
        {
          format: 'PKBarcodeFormatQR',
          message: 'https://orion.example.com/pass/token-abc',
          messageEncoding: 'iso-8859-1',
        },
      ],
    });
  });

  it('builds booking passes as event tickets that surface at the start time and expire after', () => {
    const json = applePassJson(CLASS_PASS, CONFIG);

    expect(json).not.toHaveProperty('storeCard');
    expect(json).toMatchObject({
      serialNumber: 'class-token-def',
      description: 'Starforge Foundry Class Pass',
      relevantDate: CLASS_STARTS_AT.toISO(),
      expirationDate: CLASS_STARTS_AT.plus({ hours: 2 }).toISO(),
      eventTicket: {
        headerFields: [{ key: 'kind', label: 'Pass', value: 'Class Pass' }],
        secondaryFields: [
          { key: 'holder', label: 'Attendee', value: 'Sam Smith' },
          { key: 'class', label: 'Class', value: 'Intro to Welding' },
        ],
        auxiliaryFields: [{ key: 'time', label: 'Time', value: '1:00 PM' }],
      },
      barcodes: [expect.objectContaining({ message: 'https://orion.example.com/pass/token-def' })],
    });
  });
});

describe('buildApplePass', () => {
  it('signs pass.json with the required images and configured certificates', () => {
    expect(buildApplePass(MEMBER, CONFIG).toString()).toBe('pkpass');

    const [files, certificates] = vi.mocked(PKPass).mock.calls[0];
    expect(Object.keys(files ?? {}).sort()).toEqual([
      'icon.png',
      'icon@2x.png',
      'icon@3x.png',
      'logo.png',
      'logo@2x.png',
      'logo@3x.png',
      'pass.json',
      'strip.png',
      'strip@2x.png',
      'strip@3x.png',
    ]);
    expect(JSON.parse(files!['pass.json'].toString())).toEqual(applePassJson(MEMBER, CONFIG));
    expect(certificates).toEqual({
      wwdr: 'wwdr-cert',
      signerCert: 'signer-cert',
      signerKey: 'signer-key',
      signerKeyPassphrase: 'secret',
    });
  });
});
