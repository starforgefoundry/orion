import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

/** Quote emails sent before the status page linked here. */
export const load: PageLoad = ({ url }) => {
  redirect(301, `/print_request/status/${url.searchParams.get('id') ?? ''}`);
};
