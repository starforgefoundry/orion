import { building, dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { devLoginUser } from '$lib/server/auth/staff';
import { carBayService } from '$lib/server/services/car-bay.service';
import { classService } from '$lib/server/services/class.service';
import { serviceService } from '$lib/server/services/service.service';
import { settingsService } from '$lib/server/services/settings.service';
import { NEW_MEMBER_ONBOARDING, squareService } from '$lib/server/services/square.service';
import { runEvery, runInBackground } from '$lib/server/utils/background';
import { scheduleDaily } from '$lib/server/utils/daily-schedule';
import { SPACE_ZONE } from '$lib/utils/space';
import { type Handle, type ServerInit } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { handle as authenticationHandle } from '$lib/server/auth/auth';

const REMINDER_INTERVAL_MS = 5 * 60 * 1000;
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

  runEvery(REMINDER_INTERVAL_MS, 'send car bay reminders', () => carBayService.sendDueReminders());
  runEvery(REMINDER_INTERVAL_MS, 'send class reminders', () => classService.sendDueReminders());
  runEvery(REMINDER_INTERVAL_MS, 'send service reminders', () => serviceService.sendDueReminders());

  if (dev) return;
  scheduleDaily(NIGHTLY_SYNC_HOUR, SPACE_ZONE, 'nightly Square subscription sync', async () => {
    console.log(
      'Nightly Square subscription sync:',
      await squareService.syncSubscriptions(NEW_MEMBER_ONBOARDING.SEND),
    );
  });
};
