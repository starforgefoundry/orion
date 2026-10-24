import { building, dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import type { User } from '$lib/server/db/schema';
import { carBayService } from '$lib/server/services/car_bay.service';
import { settingsService } from '$lib/server/services/settings.service';
import { squareService } from '$lib/server/services/square.service';
import { runInBackground } from '$lib/server/utils/background';
import { scheduleDaily } from '$lib/server/utils/daily_schedule';
import { SPACE_ZONE } from '$lib/server/utils/member_access';
import { type Handle, type ServerInit } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { handle as authenticationHandle } from './lib/auth/auth';

const CAR_BAY_REMINDER_INTERVAL_MS = 5 * 60 * 1000;
const NIGHTLY_SYNC_HOUR = 3;

// Skips Google sign-in during local development. Never active in production builds.
function devLoginUser(): User | undefined {
  if (!dev || !env.DEV_LOGIN_EMAIL) return undefined;
  return { email: env.DEV_LOGIN_EMAIL, name: 'Dev User', picture: '', googleCalendarId: null };
}

async function userPopulation({ event, resolve }: Parameters<Handle>[0]) {
  const session = await event.locals.auth();
  event.locals.user = session?.user ?? devLoginUser();
  return resolve(event);
}

export const handle: Handle = sequence(authenticationHandle, userPopulation);

export const init: ServerInit = () => {
  if (building) return;

  runInBackground(settingsService.importLegacyPrintPricing(), 'import print pricing from Square');

  setInterval(
    () => runInBackground(carBayService.sendDueReminders(), 'send car bay reminders'),
    CAR_BAY_REMINDER_INTERVAL_MS,
  ).unref();

  if (dev) return;
  scheduleDaily(NIGHTLY_SYNC_HOUR, SPACE_ZONE, 'nightly Square subscription sync', async () => {
    console.log(
      'Nightly Square subscription sync:',
      await squareService.syncSubscriptions({ onboardNewMembers: true }),
    );
  });
};
