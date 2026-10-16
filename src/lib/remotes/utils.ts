import { getRequestEvent } from '$app/server';
import { env } from '$env/dynamic/private';
import { squareWebhookUrl } from '$lib/server/utils/square';
import { WebhooksHelper } from 'square';

export const HTTP_FOUND = 302;
export const HTTP_NOT_FOUND = 404;

export function verifyAuth() {
  const event = getRequestEvent();
  if (!event.locals.user) {
    throw new Error('Unauthorized');
  }

  return event.locals.user;
}

export async function verifySquareSigning(body: string) {
  const event = getRequestEvent();
  const signature = event.request.headers.get('x-square-hmacsha256-signature');

  if (!signature) {
    throw new Error('Missing signature header');
  }

  const validated = await WebhooksHelper.verifySignature({
    requestBody: body,
    signatureHeader: signature,
    signatureKey: env.SQUARE_WEBHOOK_SIGNATURE_KEY!,
    notificationUrl: squareWebhookUrl(),
  });

  if (!validated) {
    throw new Error('Invalid signature');
  }
}
