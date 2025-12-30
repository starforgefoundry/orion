import { printFilesRepository } from '$lib/server/repositories/print_files.repository';
import type { RequestHandler } from '@sveltejs/kit';

// TODO: url.searchparams for auth
export const GET: RequestHandler = async ({ params }) => {
  if (!params.id) {
    return new Response('Print request ID is required', { status: 400 });
  }

  const zip = await printFilesRepository.downloadRequestZIP(params.id);

  return new Response(zip, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="print_request_${params.id}.zip"`,
    },
  });
};
