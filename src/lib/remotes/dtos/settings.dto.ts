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
