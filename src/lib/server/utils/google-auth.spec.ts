import { generateKeyPairSync, verify } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { signGoogleJwt } from './google-auth';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PRIVATE_KEY_PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

function decodeSegment(segment: string) {
  return JSON.parse(Buffer.from(segment, 'base64url').toString());
}

describe(signGoogleJwt.name, () => {
  it('returns an RS256 JWT carrying the claims, signed by the key', () => {
    const claims = { iss: 'robot@project.iam.gserviceaccount.com', iat: 1 };

    const [header, payload, signature] = signGoogleJwt(claims, PRIVATE_KEY_PEM).split('.');

    expect(decodeSegment(header)).toEqual({ alg: 'RS256', typ: 'JWT' });
    expect(decodeSegment(payload)).toEqual(claims);
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
