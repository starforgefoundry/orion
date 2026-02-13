import * as v from 'valibot';

export const printRequestSquareSettings = v.object({
  locationId: v.string(),
  memberPrintDiscountId: v.string(),
  printRequestItemId: v.string(),
  additionalBuildPlateItemId: v.string(),
});

export const printRequestSettings = v.object({
  maxUploadMB: v.number(),
  allowedFileTypes: v.string(),
  discordWebhookUrl: v.string(),
  bblAuthorizationToken: v.string(),
  bblUserId: v.string(),
});
