import { getRequestEvent } from '$app/server';
import { env } from '$env/dynamic/private';
import { UserError } from '$lib/errors';
import { HTTP_STATUS } from '$lib/http';
import { squareWebhookUrl } from '$lib/server/utils/square';
import { error } from '@sveltejs/kit';
import { WebhooksHelper } from 'square';

export const INVALID_LINK_MESSAGE = 'This link is invalid or has expired';

export function verifyAuth() {
  const event = getRequestEvent();
  if (!event.locals.user) {
    error(HTTP_STATUS.UNAUTHORIZED, 'Unauthorized');
  }

  return event.locals.user;
}

/**
 * Remote functions hide the message of any error that is not an HttpError, so user errors are
 * rethrown as one with their status.
 */
export function exposeUserErrors<Args extends unknown[], Result>(
  handler: (...args: Args) => Result | Promise<Result>,
) {
  return async (...args: Args): Promise<Result> => {
    try {
      return await handler(...args);
    } catch (cause) {
      if (cause instanceof UserError) error(cause.status, cause.message);
      throw cause;
    }
  };
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
