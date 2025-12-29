import { type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { handle as authenticationHandle } from './lib/auth/auth';

async function employeePopulation({ event, resolve }: Parameters<Handle>[0]) {
  const session = await event.locals.auth();
  event.locals.user = session?.user;
  return resolve(event);
}

export const handle: Handle = sequence(authenticationHandle, employeePopulation);
