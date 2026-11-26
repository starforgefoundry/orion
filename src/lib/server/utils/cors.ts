import { fuckmeshOrigin } from '$lib/utils/fuckmesh';

/** For signed file links only: the signature, not a session, is what authorizes the request. */
export function fuckmeshCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': fuckmeshOrigin(),
    'Access-Control-Expose-Headers': 'Content-Disposition',
  };
}
