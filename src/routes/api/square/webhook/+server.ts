import { HTTP_STATUS } from '$lib/http';
import { squareService } from '$lib/server/services/square.service';
import {
  isSquareSignatureValid,
  SQUARE_SIGNATURE_HEADER,
  type SquareWebhook,
} from '$lib/server/utils/square';
import { error, json, type RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.text();
  if (!(await isSquareSignatureValid(body, request.headers.get(SQUARE_SIGNATURE_HEADER)))) {
    error(HTTP_STATUS.UNAUTHORIZED, 'Invalid signature');
  }

  return json(await squareService.processWebhook(JSON.parse(body) as SquareWebhook));
};
