import { signIn } from '$lib/auth/auth';
import { redirect } from '@sveltejs/kit';
import type { Actions, RequestEvent } from './$types';

export async function load(event: RequestEvent) {
  const session = await event.locals.auth();

  // If the user is already logged in, redirect to staff main page
  if (session?.user) {
    redirect(302, '/main');
  }

  return {};
}

export const actions: Actions = { default: signIn };
