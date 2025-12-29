import { signOut } from '$lib/auth/auth';
import { redirect, type Actions } from '@sveltejs/kit';

export const load = async () => {
  throw redirect(302, '/');
};

export const actions: Actions = { default: signOut };
