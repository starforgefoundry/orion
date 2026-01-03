import { handleSquareWebhook } from '$lib/remotes/endpoints/square.remote';
import { json, type RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ params, request }) => {
  return json(await handleSquareWebhook(await request.text()));
};
