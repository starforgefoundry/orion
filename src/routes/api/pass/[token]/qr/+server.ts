import { HTTP_STATUS } from '$lib/http';
import { passService } from '$lib/server/services/pass.service';
import { error, type RequestHandler } from '@sveltejs/kit';

const CACHE_FOR_A_DAY = 'public, max-age=86400';

export const GET: RequestHandler = async ({ params }) => {
  const image = await passService.getQrImage(params.token ?? '');
  if (!image) error(HTTP_STATUS.NOT_FOUND, 'Pass not found');

  return new Response(new Uint8Array(image.body), {
    headers: { 'Content-Type': image.contentType, 'Cache-Control': CACHE_FOR_A_DAY },
  });
};
