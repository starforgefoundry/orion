import { env } from '$env/dynamic/private';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';

export const FILE_ROUTE = '/files';
export const SIGNED_PREFIXES = ['waivers/', 'print_requests/'];
const SIGNED_URL_TTL_SECONDS = 12 * 60 * 60;
const DEFAULT_STORAGE_DIR = 'storage';

export class InvalidStorageKeyError extends Error {}

function storageRoot() {
  return resolve(env.STORAGE_DIR || DEFAULT_STORAGE_DIR);
}

export function storagePath(key: string) {
  const root = storageRoot();
  const path = resolve(root, key);
  if (!path.startsWith(root + sep)) {
    throw new InvalidStorageKeyError(`Invalid storage key: ${key}`);
  }
  return path;
}

export async function saveFile(file: File, key: string) {
  const path = storagePath(key);
  await mkdir(dirname(path), { recursive: true });
  await pipeline(Readable.fromWeb(file.stream() as NodeReadableStream), createWriteStream(path));
  return key;
}

export async function openFile(key: string) {
  const path = storagePath(key);
  const { size } = await stat(path);
  return { size, stream: createReadStream(path) };
}

export function requiresSignature(key: string) {
  return SIGNED_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function signature(key: string, expires: number) {
  if (!env.FILE_SIGNING_SECRET) throw new Error('FILE_SIGNING_SECRET is not set');
  return createHmac('sha256', env.FILE_SIGNING_SECRET)
    .update(`${key}:${expires}`)
    .digest('base64url');
}

export function verifySignature(key: string, expires: string | null, provided: string | null) {
  if (!expires || !provided) return false;

  const expiresAt = Number(expires);
  if (!Number.isInteger(expiresAt) || expiresAt * 1000 < Date.now()) return false;

  const expected = Buffer.from(signature(key, expiresAt));
  const actual = Buffer.from(provided);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function fileUrl(key: string): string;
export function fileUrl(key: string | null | undefined): string | null;
export function fileUrl(key: string | null | undefined): string | null {
  if (!key) return null;

  const url = `${FILE_ROUTE}/${encodeURI(key)}`;
  if (!requiresSignature(key)) return url;

  const expires = Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SECONDS;
  const query = new URLSearchParams({
    expires: String(expires),
    signature: signature(key, expires),
  });
  return `${url}?${query}`;
}
