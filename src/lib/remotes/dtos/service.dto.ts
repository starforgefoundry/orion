import { enumValues } from '$lib/utils/member-enums';
import {
  SERVICE_FIELD_ID_PATTERN,
  SERVICE_FIELD_TYPE,
  SERVICE_PRICING,
  SERVICE_REQUEST_STATUS,
} from '$lib/utils/services';
import * as v from 'valibot';

// ── Catalog ──

const serviceFieldDto = v.object({
  id: v.pipe(v.string(), v.regex(SERVICE_FIELD_ID_PATTERN)),
  label: v.pipe(v.string(), v.trim(), v.minLength(1, 'Every field needs a label.')),
  type: v.picklist(enumValues(SERVICE_FIELD_TYPE)),
  required: v.boolean(),
  options: v.array(v.pipe(v.string(), v.trim(), v.minLength(1))),
});

export const upsertServiceDto = v.object({
  id: v.optional(v.string()),
  name: v.pipe(v.string(), v.trim(), v.minLength(1)),
  description: v.pipe(v.string(), v.trim(), v.minLength(1)),
  pricingMode: v.picklist(enumValues(SERVICE_PRICING)),
  price: v.pipe(v.number(), v.integer(), v.minValue(0)), // in cents
  fields: v.pipe(
    v.array(serviceFieldDto),
    v.check(
      (fields) => new Set(fields.map((field) => field.id)).size === fields.length,
      'Field ids must be unique.',
    ),
    v.check(
      (fields) =>
        fields.every(
          (field) => field.type !== SERVICE_FIELD_TYPE.SELECT || field.options.length > 0,
        ),
      'Every choice field needs at least one choice.',
    ),
  ),
  enabled: v.boolean(),
});

export type UpsertServiceDto = v.InferInput<typeof upsertServiceDto>;

// ── Request ──

export const submitServiceRequestDto = v.object({
  serviceId: v.string(),
  customerName: v.pipe(v.string(), v.trim(), v.minLength(1)),
  email: v.pipe(v.string(), v.trim(), v.email()),
  answers: v.optional(
    v.record(v.string(), v.union([v.string(), v.number(), v.boolean(), v.file()])),
    {},
  ),
});

export type SubmitServiceRequestDto = v.InferInput<typeof submitServiceRequestDto>;

export const updateServiceRequestStatusDto = v.object({
  id: v.string(),
  status: v.picklist(enumValues(SERVICE_REQUEST_STATUS)),
});

export type UpdateServiceRequestStatusDto = v.InferInput<typeof updateServiceRequestStatusDto>;

export const quoteServiceRequestDto = v.object({
  id: v.string(),
  price: v.pipe(v.number(), v.integer(), v.minValue(1, 'Enter a quote above $0.')), // in cents
});

export type QuoteServiceRequestDto = v.InferInput<typeof quoteServiceRequestDto>;
