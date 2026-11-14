import { enumValues } from '$lib/utils/member-enums';
import {
  answerProblem,
  fileUploadLimitMB,
  MAX_SERVICE_UPLOAD_TOTAL_MB,
  SERVICE_FIELD_ID_PATTERN,
  SERVICE_FIELD_TYPE,
  SERVICE_PRICING,
  SERVICE_REQUEST_STATUS,
  type ServiceField,
} from '$lib/utils/services';
import * as v from 'valibot';

// ── Catalog ──

const serviceFieldDto = v.pipe(
  v.object({
    id: v.pipe(v.string(), v.regex(SERVICE_FIELD_ID_PATTERN)),
    label: v.pipe(v.string(), v.trim(), v.minLength(1, 'Enter a question.')),
    type: v.picklist(enumValues(SERVICE_FIELD_TYPE)),
    required: v.boolean(),
    options: v.array(v.pipe(v.string(), v.trim(), v.minLength(1))),
    fileTypes: v.optional(
      v.array(
        v.pipe(
          v.string(),
          v.regex(
            /^[a-z0-9]+$/,
            (issue) => `“${issue.input}” is not a file type. Use extensions like pdf or svg.`,
          ),
        ),
      ),
    ),
    maxUploadMB: v.optional(
      v.pipe(
        v.number('Enter a max size in MB.'),
        v.integer('Use a whole number of MB.'),
        v.minValue(1, 'Max size must be at least 1 MB.'),
        v.maxValue(
          MAX_SERVICE_UPLOAD_TOTAL_MB,
          `Max size must be at most ${MAX_SERVICE_UPLOAD_TOTAL_MB} MB.`,
        ),
      ),
    ),
  }),
  v.forward(
    v.partialCheck(
      [['type'], ['options']],
      (field) => field.type !== SERVICE_FIELD_TYPE.SELECT || field.options.length > 0,
      'Enter at least one choice.',
    ),
    ['options'],
  ),
  v.forward(
    v.partialCheck(
      [['options']],
      (field) =>
        new Set(field.options.map((option) => option.toLowerCase())).size === field.options.length,
      'Choices must be different.',
    ),
    ['options'],
  ),
);

export const upsertServiceDto = v.object({
  id: v.optional(v.string()),
  name: v.pipe(v.string(), v.trim(), v.minLength(1, 'Enter a service name.')),
  description: v.pipe(v.string(), v.trim(), v.minLength(1, 'Enter a description.')),
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
        fields
          .filter((field) => field.type === SERVICE_FIELD_TYPE.FILE)
          .reduce((total, field) => total + fileUploadLimitMB(field), 0) <=
        MAX_SERVICE_UPLOAD_TOTAL_MB,
      `File fields can allow at most ${MAX_SERVICE_UPLOAD_TOTAL_MB} MB combined.`,
    ),
  ),
  enabled: v.boolean(),
});

export type UpsertServiceDto = v.InferInput<typeof upsertServiceDto>;

// ── Request ──

export const submitServiceRequestDto = v.object({
  serviceId: v.string(),
  customerName: v.pipe(v.string(), v.trim(), v.minLength(1, 'Enter your name.')),
  email: v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty('Enter your email address.'),
    v.email('Enter a valid email address.'),
  ),
  answers: v.optional(
    v.record(v.string(), v.union([v.string(), v.number(), v.boolean(), v.file()])),
    {},
  ),
});

export type SubmitServiceRequestDto = v.InferInput<typeof submitServiceRequestDto>;

/** Adds one service's answer rules to the request schema, so the form can report them before sending. */
export function serviceRequestSchema(fields: ServiceField[]) {
  type RequestSchema = v.GenericSchema<
    SubmitServiceRequestDto,
    v.InferOutput<typeof submitServiceRequestDto>
  >;
  return fields.reduce<RequestSchema>(
    (schema, field) =>
      v.pipe(
        schema,
        v.forward(
          v.partialCheck(
            [['answers', field.id]],
            (request) => !answerProblem(field, request.answers[field.id]),
            (issue) => answerProblem(field, issue.input.answers[field.id]) ?? '',
          ),
          ['answers', field.id],
        ),
      ),
    submitServiceRequestDto,
  );
}

export const updateServiceRequestStatusDto = v.object({
  id: v.string(),
  status: v.picklist(enumValues(SERVICE_REQUEST_STATUS)),
});

export type UpdateServiceRequestStatusDto = v.InferInput<typeof updateServiceRequestStatusDto>;

export const priceServiceRequestDto = v.object({
  id: v.string(),
  price: v.pipe(v.number(), v.integer(), v.minValue(1, 'Enter a quote above $0.')), // in cents
});

export type PriceServiceRequestDto = v.InferInput<typeof priceServiceRequestDto>;
