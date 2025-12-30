import { customType } from 'drizzle-orm/sqlite-core';
import { DateTime } from 'luxon';

export const luxonTimestamp = customType<{
  data: DateTime;
  driverData: string;
}>({
  dataType() {
    return 'timestamp'; // or "timestamp(6)" if you want microsecond storage
  },

  fromDriver(value) {
    const [datePart, timePart] = value.split(' ');
    const [sec, us] = timePart.split('.');
    const ms = Math.floor(Number(us) / 1000);

    const iso = `${datePart}T${sec}.${String(ms).padStart(3, '0')}`;
    const date = DateTime.fromISO(iso, { zone: 'utc' }).setZone('America/Chicago');

    return date;
  },

  toDriver(dt) {
    if (!dt || !dt.isValid) {
      throw new Error('Invalid Luxon DateTime');
    }

    const iso = dt.toISO({
      suppressMilliseconds: false,
      suppressSeconds: false,
      includeOffset: false,
    });

    const [date, time] = iso!.split('T');
    const [hms, msStr] = time.split('.');

    const ms = msStr.replace('Z', '').padStart(3, '0');
    const us = ms + '000'; // microseconds = milliseconds * 1000

    return `${date} ${hms}.${us}`;
  },
});
