// +layout.server.ts
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
  // Allow access to auth routes without authentication
  if (!event.url.pathname.startsWith('/auth/') && !event.locals.user) {
    redirect(302, '/auth/login');
  }

  return { user: event.locals.user };
};

export const ssr = false;
