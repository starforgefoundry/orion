// +layout.server.ts
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
  if (!event.locals.user) {
    // Allow access to staff when authenticated
    if (event.url.pathname.startsWith('/staff')) {
      redirect(302, '/auth/login');
    }
  }

  return { user: event.locals.user };
};

export const ssr = false;
