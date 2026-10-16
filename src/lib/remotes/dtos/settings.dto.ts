import * as v from 'valibot';

export const printRequestSquareSettings = v.object({
  locationId: v.string(),
  memberPrintDiscountId: v.string(),
  printRequestItemId: v.string(),
  additionalBuildPlateItemId: v.string(),
});

export const printRequestSettings = v.object({
  isOpen: v.optional(v.boolean(), false),
  announcement: v.optional(v.string(), ''),
  announcementUntil: v.optional(v.string(), ''),
  maxUploadMB: v.number(),
  allowedFileTypes: v.string(),
  discordWebhookUrl: v.string(),
});

// Everything in here is served to anonymous visitors of the print request form.
export const publicPrintRequestFormDto = v.object({
  isOpen: v.boolean(),
  announcement: v.string(),
  announcementUntil: v.string(),
  maxUploadMB: v.number(),
  allowedFileTypes: v.string(),
  materials: v.array(
    v.object({
      id: v.string(),
      name: v.string(),
    }),
  ),
});

export type PublicPrintRequestFormDto = v.InferInput<typeof publicPrintRequestFormDto>;

export const bambuddySettings = v.object({
  serverUrl: v.pipe(v.string(), v.url('Enter a valid server URL')),
  apiKey: v.string(),
});

export const classSettingsDto = v.object({
  discordWebhookUrl: v.string(),
});

const cents = v.pipe(v.number(), v.integer(), v.minValue(0));
const pricePair = v.object({ member: cents, nonMember: cents });

export const carBayRatesDto = v.object({
  quickJob: pricePair,
  hourly: pricePair,
  fullDayWeekday: pricePair,
  fullDayWeekend: pricePair,
  overrunHourly: pricePair,
  overnightFee: pricePair,
});

function wholeNumberBetween(min: number, max: number) {
  return v.pipe(v.number(), v.integer(), v.minValue(min), v.maxValue(max));
}

const HOURS_IN_DAY = 24;
const MINUTES_IN_HOUR = 60;

export const carBayPolicyDto = v.pipe(
  v.object({
    weekdayOpenHour: wholeNumberBetween(0, HOURS_IN_DAY - 1),
    weekendOpenHour: wholeNumberBetween(0, HOURS_IN_DAY - 1),
    weekdayCloseHour: wholeNumberBetween(1, HOURS_IN_DAY - 1),
    weekendCloseHour: wholeNumberBetween(1, HOURS_IN_DAY - 1),
    quickJobMinutes: wholeNumberBetween(15, 12 * MINUTES_IN_HOUR),
    hourlyMinHours: wholeNumberBetween(1, HOURS_IN_DAY),
    fullDayMaxDays: wholeNumberBetween(1, 14),
    bufferMinutes: wholeNumberBetween(0, 4 * MINUTES_IN_HOUR),
    publicHorizonDays: wholeNumberBetween(0, 365),
    refundCutoffHours: wholeNumberBetween(0, 14 * HOURS_IN_DAY),
    reminderLeadHours: wholeNumberBetween(1, 14 * HOURS_IN_DAY),
    storageDays: wholeNumberBetween(0, 60),
  }),
  v.check(
    (policy) =>
      policy.weekdayCloseHour > policy.weekdayOpenHour &&
      policy.weekendCloseHour > policy.weekendOpenHour,
    'Closing time must be after opening time',
  ),
);
export const memberSquareSettingsDto = v.object({
  dayPassItemVariationIds: v.optional(v.array(v.string()), []),
});
