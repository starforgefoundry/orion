import { redirect } from '@sveltejs/kit';

export const load = () => {
  throw redirect(307, '/staff/print_queue');
};
