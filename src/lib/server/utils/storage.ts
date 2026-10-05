import { env } from '$env/dynamic/private';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { signUrl } from '$lib/server/utils/signed_url';

export const FILE_ROUTE = '/files';
export const SIGNED_PREFIXES = ['waivers/', 'print_requests/'];
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

export function fileUrl(key: string): string;
export function fileUrl(key: string | null | undefined): string | null;
export function fileUrl(key: string | null | undefined): string | null {
  if (!key) return null;

  const url = `${FILE_ROUTE}/${encodeURI(key)}`;
  return requiresSignature(key) ? signUrl(url) : url;
}
