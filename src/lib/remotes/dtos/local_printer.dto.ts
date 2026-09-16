import * as v from 'valibot';

export const localPrinterDto = v.object({
  id: v.string(),
  name: v.string(),
  localIp: v.string(),
  serial: v.string(),
  accessCode: v.string(),
});

export type LocalPrinterDto = v.InferInput<typeof localPrinterDto>;

export const upsertLocalPrinterDto = v.object({
  id: v.optional(v.string()),
  name: v.pipe(v.string(), v.trim(), v.minLength(1, 'Name is required')),
  localIp: v.pipe(v.string(), v.trim(), v.ipv4('Enter a valid IPv4 address')),
  serial: v.pipe(v.string(), v.trim(), v.minLength(1, 'Serial number is required')),
  accessCode: v.pipe(v.string(), v.trim(), v.minLength(1, 'Access code is required')),
});

export type UpsertLocalPrinterDto = v.InferInput<typeof upsertLocalPrinterDto>;

export const deleteLocalPrinterDto = v.object({
  id: v.string(),
});
