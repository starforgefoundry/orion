import {
  InvalidStorageKeyError,
  openFile,
  requiresSignature,
  verifySignature,
} from '$lib/server/utils/storage';
import { error, type RequestHandler } from '@sveltejs/kit';
import { Readable } from 'node:stream';

const PUBLIC_CACHE = 'public, max-age=31536000, immutable';
const SIGNED_CACHE = 'private, max-age=3600';

function isMissingFile(e: unknown) {
  return (e as NodeJS.ErrnoException)?.code === 'ENOENT';
}

export const GET: RequestHandler = async ({ params, url }) => {
  const key = params.key ?? '';
  const signed = requiresSignature(key);

  if (
    signed &&
    !verifySignature(key, url.searchParams.get('expires'), url.searchParams.get('signature'))
  ) {
    error(403, 'This link is invalid or has expired');
  }

  try {
    const { size, stream } = await openFile(key);

    return new Response(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(size),
        'Cache-Control': signed ? SIGNED_CACHE : PUBLIC_CACHE,
        'Content-Security-Policy': 'sandbox',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    if (e instanceof InvalidStorageKeyError) error(400, 'Invalid file path');
    if (isMissingFile(e)) error(404, 'File not found');
    throw e;
  }
};
