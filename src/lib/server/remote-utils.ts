import { getRequestEvent } from '$app/server';
import { UserError } from '$lib/errors';
import { HTTP_STATUS } from '$lib/http';
import { error } from '@sveltejs/kit';

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
