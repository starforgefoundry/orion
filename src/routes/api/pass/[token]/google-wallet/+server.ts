import { HTTP_FOUND, HTTP_NOT_FOUND } from '$lib/remotes/utils';
import { onboardingService } from '$lib/server/services/onboarding.service';
import { error, redirect, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ params }) => {
  const saveUrl = await onboardingService.getGoogleWalletUrl(params.token ?? '');
  if (!saveUrl) error(HTTP_NOT_FOUND, 'Google Wallet pass is not available');

  redirect(HTTP_FOUND, saveUrl);
};
