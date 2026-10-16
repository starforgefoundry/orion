import { HTTP_NOT_FOUND } from '$lib/remotes/utils';
import { onboardingService } from '$lib/server/services/onboarding.service';
import { APPLE_PASS_CONTENT_TYPE } from '$lib/server/utils/apple_wallet';
import { error, type RequestHandler } from '@sveltejs/kit';

const PASS_FILENAME = 'starforge-member.pkpass';

export const GET: RequestHandler = async ({ params }) => {
  const pass = await onboardingService.getApplePass(params.token ?? '');
  if (!pass) error(HTTP_NOT_FOUND, 'Apple Wallet pass is not available');

  return new Response(new Uint8Array(pass), {
    headers: {
      'Content-Type': APPLE_PASS_CONTENT_TYPE,
      'Content-Disposition': `attachment; filename="${PASS_FILENAME}"`,
    },
  });
};
