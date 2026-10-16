import { env } from '$env/dynamic/private';
import ICON from '$lib/assets/wallet/icon.png?inline';
import ICON_2X from '$lib/assets/wallet/icon@2x.png?inline';
import ICON_3X from '$lib/assets/wallet/icon@3x.png?inline';
import LOGO from '$lib/assets/wallet/logo.png?inline';
import LOGO_2X from '$lib/assets/wallet/logo@2x.png?inline';
import LOGO_3X from '$lib/assets/wallet/logo@3x.png?inline';
import STRIP from '$lib/assets/wallet/strip.png?inline';
import STRIP_2X from '$lib/assets/wallet/strip@2x.png?inline';
import STRIP_3X from '$lib/assets/wallet/strip@3x.png?inline';
import type { Member } from '$lib/server/db/schema';
import { passUrl } from '$lib/server/utils/member_links';
import { memberSince, PASS_BRAND } from '$lib/server/utils/pass_brand';
import { PKPass } from 'passkit-generator';

export const APPLE_PASS_CONTENT_TYPE = 'application/vnd.apple.pkpass';
const PASS_FORMAT_VERSION = 1;
const ORGANIZATION_NAME = 'Starforge Foundry';
const PASS_DESCRIPTION = 'Starforge Foundry member pass';
const BACKGROUND_COLOR = `rgb(${PASS_BRAND.navy.join(', ')})`;
const FOREGROUND_COLOR = `rgb(${PASS_BRAND.white.join(', ')})`;
const LABEL_COLOR = `rgb(${PASS_BRAND.gold.join(', ')})`;
const BARCODE_FORMAT_QR = 'PKBarcodeFormatQR';
const BARCODE_ENCODING = 'iso-8859-1';
const TEXT_ALIGN_RIGHT = 'PKTextAlignmentRight';

const PASS_IMAGES: Record<string, string> = {
  'icon.png': ICON,
  'icon@2x.png': ICON_2X,
  'icon@3x.png': ICON_3X,
  'logo.png': LOGO,
  'logo@2x.png': LOGO_2X,
  'logo@3x.png': LOGO_3X,
  'strip.png': STRIP,
  'strip@2x.png': STRIP_2X,
  'strip@3x.png': STRIP_3X,
};

export type AppleWalletConfig = {
  passTypeId: string;
  teamId: string;
  signerCert: string;
  signerKey: string;
  signerKeyPassphrase?: string;
  wwdr: string;
};

type WalletMember = Pick<Member, 'id' | 'name' | 'passToken' | 'createdDate'>;

function unescapePem(value: string) {
  return value.replace(/\\n/g, '\n');
}

export function appleWalletConfig(): AppleWalletConfig | undefined {
  const {
    APPLE_PASS_TYPE_ID,
    APPLE_TEAM_ID,
    APPLE_PASS_CERT,
    APPLE_PASS_KEY,
    APPLE_PASS_KEY_PASSPHRASE,
    APPLE_WWDR_CERT,
  } = env;
  if (
    !APPLE_PASS_TYPE_ID ||
    !APPLE_TEAM_ID ||
    !APPLE_PASS_CERT ||
    !APPLE_PASS_KEY ||
    !APPLE_WWDR_CERT
  ) {
    return undefined;
  }

  return {
    passTypeId: APPLE_PASS_TYPE_ID,
    teamId: APPLE_TEAM_ID,
    signerCert: unescapePem(APPLE_PASS_CERT),
    signerKey: unescapePem(APPLE_PASS_KEY),
    signerKeyPassphrase: APPLE_PASS_KEY_PASSPHRASE || undefined,
    wwdr: unescapePem(APPLE_WWDR_CERT),
  };
}

export function applePassJson(member: WalletMember, config: AppleWalletConfig) {
  return {
    formatVersion: PASS_FORMAT_VERSION,
    passTypeIdentifier: config.passTypeId,
    teamIdentifier: config.teamId,
    serialNumber: member.id,
    organizationName: ORGANIZATION_NAME,
    description: PASS_DESCRIPTION,
    logoText: ORGANIZATION_NAME,
    backgroundColor: BACKGROUND_COLOR,
    foregroundColor: FOREGROUND_COLOR,
    labelColor: LABEL_COLOR,
    storeCard: {
      secondaryFields: [
        { key: 'member', label: 'Member', value: member.name },
        {
          key: 'memberSince',
          label: 'Member since',
          value: memberSince(member),
          textAlignment: TEXT_ALIGN_RIGHT,
        },
      ],
      backFields: [
        { key: 'howTo', label: 'Checking in', value: PASS_BRAND.checkInInstructions },
        { key: 'website', label: 'Website', value: PASS_BRAND.website },
        { key: 'contact', label: 'Questions', value: PASS_BRAND.contactEmail },
      ],
    },
    barcodes: [
      {
        format: BARCODE_FORMAT_QR,
        message: passUrl(member),
        messageEncoding: BARCODE_ENCODING,
      },
    ],
  };
}

function dataUrlToBuffer(dataUrl: string) {
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
}

export function buildApplePass(member: WalletMember, config: AppleWalletConfig): Buffer {
  const images = Object.fromEntries(
    Object.entries(PASS_IMAGES).map(([name, dataUrl]) => [name, dataUrlToBuffer(dataUrl)]),
  );

  const pass = new PKPass(
    { ...images, 'pass.json': Buffer.from(JSON.stringify(applePassJson(member, config))) },
    {
      wwdr: config.wwdr,
      signerCert: config.signerCert,
      signerKey: config.signerKey,
      signerKeyPassphrase: config.signerKeyPassphrase,
    },
  );

  return pass.getAsBuffer();
}
