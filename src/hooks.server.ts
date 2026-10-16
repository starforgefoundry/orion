import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import type { User } from '$lib/server/db/schema';
import { type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { handle as authenticationHandle } from './lib/auth/auth';

// Skips Google sign-in during local development. Never active in production builds.
function devLoginUser(): User | undefined {
  if (!dev || !env.DEV_LOGIN_EMAIL) return undefined;
  return { email: env.DEV_LOGIN_EMAIL, name: 'Dev User', picture: '', googleCalendarId: null };
}

async function userPopulation({ event, resolve }: Parameters<Handle>[0]) {
  const session = await event.locals.auth();
  event.locals.user = session?.user ?? devLoginUser();
  return resolve(event);
}

export const handle: Handle = sequence(authenticationHandle, userPopulation);
