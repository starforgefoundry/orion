import { waiverService } from '$lib/server/services/waiver.service';
import { generateWaiverPdf } from '$lib/server/utils/waiver-pdf';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  if (!params.id) {
    return new Response('Waiver ID is required', { status: 400 });
  }

  const waiver = await waiverService.getWaiverById(params.id);
  if (!waiver) {
    return new Response('Waiver not found', { status: 404 });
  }

  const pdf = await generateWaiverPdf(waiver);

  return new Response(new Uint8Array(pdf) as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="waiver_${waiver.lastName}_${waiver.firstName}.pdf"`,
    },
  });
};
