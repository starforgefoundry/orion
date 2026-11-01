import { HTTP_STATUS } from '$lib/http';
import { passService } from '$lib/server/services/pass.service';
import { error, redirect, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ params }) => {
  const saveUrl = await passService.getGoogleWalletUrl(params.token ?? '');
  if (!saveUrl) error(HTTP_STATUS.NOT_FOUND, 'Google Wallet pass is not available');

  redirect(HTTP_STATUS.FOUND, saveUrl);
};
