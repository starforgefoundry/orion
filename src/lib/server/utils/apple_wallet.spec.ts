import { DateTime } from 'luxon';
import { PKPass } from 'passkit-generator';
import { describe, expect, it, vi } from 'vitest';
import { applePassJson, buildApplePass, type AppleWalletConfig } from './apple_wallet';

vi.mock('$env/dynamic/private', () => ({
  env: { FRONTEND_URL: 'https://orion.example.com' },
}));

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

const MEMBER = {
  id: 'member-1',
  name: 'Sam Smith',
  passToken: 'token-abc',
  createdDate: DateTime.fromISO('2026-03-01T03:00:00Z'),
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
        secondaryFields: [
          { key: 'member', label: 'Member', value: 'Sam Smith' },
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
