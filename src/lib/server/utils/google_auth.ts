import { sign } from 'node:crypto';

const JWT_HEADER = { alg: 'RS256', typ: 'JWT' };
const JWT_SIGNING_HASH = 'sha256';

function base64Url(value: string | Buffer) {
  return Buffer.from(value).toString('base64url');
}

/** Signs claims as an RS256 JWT with a Google service account's PEM private key. */
export function signGoogleJwt(claims: object, privateKeyPem: string) {
  const unsigned = `${base64Url(JSON.stringify(JWT_HEADER))}.${base64Url(JSON.stringify(claims))}`;
  const signature = sign(JWT_SIGNING_HASH, Buffer.from(unsigned), privateKeyPem);
  return `${unsigned}.${base64Url(signature)}`;
}
