import { verifySignedUrl } from '$lib/server/utils/signed_url';
import { InvalidStorageKeyError, openFile, requiresSignature } from '$lib/server/utils/storage';
import { error, type RequestHandler } from '@sveltejs/kit';
import { posix } from 'node:path';
import { Readable } from 'node:stream';

const PUBLIC_CACHE = 'public, max-age=31536000, immutable';
const SIGNED_CACHE = 'private, max-age=3600';

function isMissingFile(e: unknown) {
  return (e as NodeJS.ErrnoException)?.code === 'ENOENT';
}

function contentDisposition(key: string) {
  const fileName = posix.basename(key);
  return `attachment; filename="${fileName.replace(/["\\]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export const GET: RequestHandler = async ({ params, url }) => {
  const key = params.key ?? '';
  const signed = requiresSignature(key);

  if (signed && !verifySignedUrl(url)) {
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
        // Without this, OrcaSlicer names the file after the URL, signature query included.
        ...(signed && { 'Content-Disposition': contentDisposition(key) }),
      },
    });
  } catch (e) {
    if (e instanceof InvalidStorageKeyError) error(400, 'Invalid file path');
    if (isMissingFile(e)) error(404, 'File not found');
    throw e;
  }
};
