import { HTTP_NOT_FOUND } from '$lib/remotes/utils';
import { passService } from '$lib/server/services/pass.service';
import { APPLE_PASS_CONTENT_TYPE } from '$lib/server/utils/apple_wallet';
import { error, type RequestHandler } from '@sveltejs/kit';

const PASS_FILENAME = 'starforge-pass.pkpass';

export const GET: RequestHandler = async ({ params }) => {
  const pass = await passService.getApplePass(params.token ?? '');
  if (!pass) error(HTTP_NOT_FOUND, 'Apple Wallet pass is not available');

  return new Response(new Uint8Array(pass), {
    headers: {
      'Content-Type': APPLE_PASS_CONTENT_TYPE,
      'Content-Disposition': `attachment; filename="${PASS_FILENAME}"`,
    },
  });
};
