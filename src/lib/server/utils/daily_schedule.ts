import { runInBackground } from '$lib/server/utils/background';
import { DateTime } from 'luxon';

export function nextDailyRun(now: DateTime, hour: number, zone: string) {
  const local = now.setZone(zone);
  const today = local.set({ hour, minute: 0, second: 0, millisecond: 0 });
  return today > local ? today : today.plus({ days: 1 });
}

export function scheduleDaily(
  hour: number,
  zone: string,
  label: string,
  task: () => Promise<unknown>,
) {
  const scheduleNext = () => {
    const delay = nextDailyRun(DateTime.now(), hour, zone).diffNow().toMillis();
    setTimeout(() => {
      runInBackground(task(), label);
      scheduleNext();
    }, delay).unref();
  };
  scheduleNext();
}
