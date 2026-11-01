import { env } from '$env/dynamic/private';
import { createHmac, timingSafeEqual } from 'node:crypto';

const SIGNED_URL_TTL_SECONDS = 12 * 60 * 60;

function signature(path: string, expires: number) {
  if (!env.FILE_SIGNING_SECRET) throw new Error('FILE_SIGNING_SECRET is not set');
  return createHmac('sha256', env.FILE_SIGNING_SECRET)
    .update(`${path}:${expires}`)
    .digest('base64url');
}

/** Signs an already URL-encoded path so clients without a session, like OrcaSlicer, can fetch it. */
export function signUrl(path: string) {
  const expires = Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SECONDS;
  const query = new URLSearchParams({
    expires: String(expires),
    signature: signature(path, expires),
  });
  return `${path}?${query}`;
}

export function verifySignedUrl(url: URL) {
  const expires = url.searchParams.get('expires');
  const provided = url.searchParams.get('signature');
  if (!expires || !provided) return false;

  const expiresAt = Number(expires);
  if (!Number.isInteger(expiresAt) || expiresAt * 1000 < Date.now()) return false;

  const expected = Buffer.from(signature(url.pathname, expiresAt));
  const actual = Buffer.from(provided);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
