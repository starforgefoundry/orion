import { KIOSK_DEVICE_COOKIE, KIOSK_PAIR_TOKEN_PARAM } from '$lib/remotes/dtos/kiosk.dto';
import { kioskService } from '$lib/server/services/kiosk.service';
import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Browsers cap cookie lifetimes at 400 days.
const DEVICE_COOKIE_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;
const KIOSK_PATH = '/kiosk';
const FORBIDDEN = 403;

export const GET: RequestHandler = async ({ url, cookies }) => {
  const token = url.searchParams.get(KIOSK_PAIR_TOKEN_PARAM);
  if (!token || !(await kioskService.isPairedDevice(token))) {
    error(
      FORBIDDEN,
      'This pairing link is invalid or has been replaced. Generate a new one in Settings.',
    );
  }

  cookies.set(KIOSK_DEVICE_COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: DEVICE_COOKIE_MAX_AGE_SECONDS,
  });
  redirect(303, KIOSK_PATH);
};
