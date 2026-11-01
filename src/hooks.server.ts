import { building, dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { devLoginUser } from '$lib/auth/staff';
import { carBayService } from '$lib/server/services/car_bay.service';
import { classService } from '$lib/server/services/class.service';
import { settingsService } from '$lib/server/services/settings.service';
import { NEW_MEMBER_ONBOARDING, squareService } from '$lib/server/services/square.service';
import { runInBackground } from '$lib/server/utils/background';
import { scheduleDaily } from '$lib/server/utils/daily_schedule';
import { SPACE_ZONE } from '$lib/space';
import { type Handle, type ServerInit } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { handle as authenticationHandle } from './lib/auth/auth';

const BOOKING_REMINDER_INTERVAL_MS = 5 * 60 * 1000;
const NIGHTLY_SYNC_HOUR = 3;

async function userPopulation({ event, resolve }: Parameters<Handle>[0]) {
  const session = await event.locals.auth();
  event.locals.user = session?.user ?? devLoginUser(dev, env.DEV_LOGIN_EMAIL);
  return resolve(event);
}

export const handle: Handle = sequence(authenticationHandle, userPopulation);

export const init: ServerInit = () => {
  if (building) return;

  runInBackground(settingsService.importLegacyPrintPricing(), 'import print pricing from Square');

  setInterval(() => {
    runInBackground(carBayService.sendDueReminders(), 'send car bay reminders');
    runInBackground(classService.sendDueReminders(), 'send class reminders');
  }, BOOKING_REMINDER_INTERVAL_MS).unref();

  if (dev) return;
  scheduleDaily(NIGHTLY_SYNC_HOUR, SPACE_ZONE, 'nightly Square subscription sync', async () => {
    console.log(
      'Nightly Square subscription sync:',
      await squareService.syncSubscriptions(NEW_MEMBER_ONBOARDING.SEND),
    );
  });
};
