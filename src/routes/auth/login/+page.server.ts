import { signIn } from '$lib/auth/auth';
import { KIOSK_DEVICE_COOKIE, KIOSK_PATH } from '$lib/remotes/dtos/kiosk.dto';
import { kioskService } from '$lib/server/services/kiosk.service';
import { redirect } from '@sveltejs/kit';
import type { Actions, RequestEvent } from './$types';

export async function load(event: RequestEvent) {
  const session = await event.locals.auth();

  // If the user is already logged in, redirect to staff main page
  if (session?.user) {
    redirect(302, '/staff');
  }

  // The installed kiosk app always launches at the root, which lands here.
  if (await kioskService.isPairedDevice(event.cookies.get(KIOSK_DEVICE_COOKIE))) {
    redirect(302, KIOSK_PATH);
  }

  return {};
}

export const actions: Actions = { default: signIn };
