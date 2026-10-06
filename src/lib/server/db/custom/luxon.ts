import { customType } from 'drizzle-orm/pg-core';
import { DateTime } from 'luxon';

const DISPLAY_ZONE = 'America/Chicago';

export const luxonTimestamp = customType<{
  data: DateTime;
  driverData: string;
}>({
  dataType() {
    return 'timestamp(3) with time zone';
  },

  fromDriver(value) {
    return DateTime.fromSQL(value, { setZone: true }).setZone(DISPLAY_ZONE);
  },

  toDriver(dt) {
    if (!dt || !dt.isValid) {
      throw new Error('Invalid Luxon DateTime');
    }

    return dt.toUTC().toISO()!;
  },
});
