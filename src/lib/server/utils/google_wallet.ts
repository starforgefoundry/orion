import { env } from '$env/dynamic/private';
import { passUrl } from '$lib/server/utils/member_links';
import { hexColor, PASS_BRAND } from '$lib/server/utils/pass_brand';
import type { PassDetails } from '$lib/server/utils/pass_details';
import { sign } from 'node:crypto';

export const GOOGLE_WALLET_SAVE_URL = 'https://pay.google.com/gp/v/save';
const JWT_AUDIENCE = 'google';
const JWT_TYPE = 'savetowallet';
const JWT_HEADER = { alg: 'RS256', typ: 'JWT' };
const JWT_SIGNING_HASH = 'sha256';
const PASS_LANGUAGE = 'en-US';
const PASS_TITLE = 'Starforge Foundry';
const PASS_BACKGROUND_COLOR = hexColor(PASS_BRAND.navy);
const PASS_LOGO_PATH = '/logo.png';
const PASS_HERO_PATH = '/wallet/pass-hero.jpg';
const OBJECT_STATE_ACTIVE = 'ACTIVE';
const BARCODE_TYPE_QR = 'QR_CODE';

export type GoogleWalletConfig = {
  issuerId: string;
  classSuffix: string;
  serviceAccountEmail: string;
  privateKey: string;
  origin: string;
};

export function googleWalletConfig(): GoogleWalletConfig | undefined {
  const {
    GOOGLE_WALLET_ISSUER_ID,
    GOOGLE_WALLET_CLASS_SUFFIX,
    GOOGLE_SERVICE_ACCOUNT_EMAIL,
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
    FRONTEND_URL,
  } = env;
  if (
    !GOOGLE_WALLET_ISSUER_ID ||
    !GOOGLE_WALLET_CLASS_SUFFIX ||
    !GOOGLE_SERVICE_ACCOUNT_EMAIL ||
    !GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ||
    !FRONTEND_URL
  ) {
    return undefined;
  }

  return {
    issuerId: GOOGLE_WALLET_ISSUER_ID,
    classSuffix: GOOGLE_WALLET_CLASS_SUFFIX,
    serviceAccountEmail: GOOGLE_SERVICE_ACCOUNT_EMAIL,
    privateKey: GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n'),
    origin: FRONTEND_URL,
  };
}

function localized(value: string) {
  return { defaultValue: { language: PASS_LANGUAGE, value } };
}

export function googleWalletClaims(
  pass: PassDetails,
  config: GoogleWalletConfig,
  issuedAt: Date = new Date(),
) {
  const classId = `${config.issuerId}.${config.classSuffix}`;

  return {
    iss: config.serviceAccountEmail,
    aud: JWT_AUDIENCE,
    typ: JWT_TYPE,
    iat: Math.floor(issuedAt.getTime() / 1000),
    origins: [config.origin],
    payload: {
      genericClasses: [{ id: classId }],
      genericObjects: [
        {
          id: `${config.issuerId}.${pass.serial}`,
          classId,
          state: OBJECT_STATE_ACTIVE,
          cardTitle: localized(PASS_TITLE),
          header: localized(pass.holderName),
          subheader: localized(pass.title),
          validTimeInterval: pass.expiresAt && { end: { date: pass.expiresAt.toISO() } },
          hexBackgroundColor: PASS_BACKGROUND_COLOR,
          logo: { sourceUri: { uri: `${config.origin}${PASS_LOGO_PATH}` } },
          heroImage: { sourceUri: { uri: `${config.origin}${PASS_HERO_PATH}` } },
          textModulesData: [
            ...pass.fields.map((field) => ({
              id: field.key,
              header: field.label,
              body: field.value,
            })),
            { id: 'checking_in', header: 'Checking in', body: PASS_BRAND.checkInInstructions },
          ],
          linksModuleData: {
            uris: [
              { id: 'website', uri: PASS_BRAND.website, description: 'Website' },
              {
                id: 'contact',
                uri: `mailto:${PASS_BRAND.contactEmail}`,
                description: PASS_BRAND.contactEmail,
              },
            ],
          },
          barcode: { type: BARCODE_TYPE_QR, value: passUrl(pass) },
        },
      ],
    },
  };
}

function base64Url(value: string | Buffer) {
  return Buffer.from(value).toString('base64url');
}

export function signJwt(claims: object, privateKeyPem: string) {
  const unsigned = `${base64Url(JSON.stringify(JWT_HEADER))}.${base64Url(JSON.stringify(claims))}`;
  const signature = sign(JWT_SIGNING_HASH, Buffer.from(unsigned), privateKeyPem);
  return `${unsigned}.${base64Url(signature)}`;
}

export function googleWalletSaveUrl(pass: PassDetails, config: GoogleWalletConfig) {
  const jwt = signJwt(googleWalletClaims(pass, config), config.privateKey);
  return `${GOOGLE_WALLET_SAVE_URL}/${jwt}`;
}
