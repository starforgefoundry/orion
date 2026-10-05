import { printFilesService } from '$lib/server/services/print_files.service';
import { verifySignedUrl } from '$lib/server/utils/signed_url';
import { error, type RequestHandler } from '@sveltejs/kit';
import { Readable } from 'node:stream';

export const GET: RequestHandler = async ({ params, url }) => {
  if (!params.id) {
    return new Response('Print request ID is required', { status: 400 });
  }

  if (!verifySignedUrl(url)) {
    error(403, 'This link is invalid or has expired');
  }

  const zip = await printFilesService.downloadRequestZIP(params.id);

  return new Response(Readable.toWeb(zip) as ReadableStream, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="print_request_${params.id}.zip"`,
    },
  });
};
