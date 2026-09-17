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
  bblAuthorizationToken: v.string(),
  bblUserId: v.string(),
});

export const bambuLoginDto = v.object({
  account: v.pipe(v.string(), v.email('Enter a valid email address')),
  password: v.pipe(v.string(), v.minLength(1, 'Password is required')),
  tfaCode: v.pipe(
    v.string(),
    v.regex(/^\d{6}$/, 'Enter the 6-digit code from your authenticator app'),
  ),
});

export const classSettingsDto = v.object({
  discordWebhookUrl: v.string(),
});
