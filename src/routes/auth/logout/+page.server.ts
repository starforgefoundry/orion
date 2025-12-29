import { signOut } from '$lib/auth/auth';
import { redirect, type Actions } from '@sveltejs/kit';

export const actions: Actions = {
  default: async (event) => {
    await signOut(event);
    throw redirect(302, '/auth/login');
  }
};
