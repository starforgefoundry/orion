import { getRequestEvent } from '$app/server';

export function verifyAuth() {
  const event = getRequestEvent();
  if (!event.locals.user) {
    throw new Error('Unauthorized');
  }

  return event.locals.user;
}
