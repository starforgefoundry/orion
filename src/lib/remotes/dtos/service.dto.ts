import { enumValues } from '$lib/utils/member-enums';
import {
  MAX_SERVICE_UPLOAD_LIMIT_MB,
  SERVICE_FIELD_ID_PATTERN,
  SERVICE_FIELD_TYPE,
  SERVICE_PRICING,
  SERVICE_REQUEST_STATUS,
} from '$lib/utils/services';
import * as v from 'valibot';

// ── Catalog ──

const serviceFieldDto = v.pipe(
  v.object({
    id: v.pipe(v.string(), v.regex(SERVICE_FIELD_ID_PATTERN)),
    label: v.pipe(v.string(), v.trim(), v.minLength(1, 'Enter a label for this field.')),
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
          MAX_SERVICE_UPLOAD_LIMIT_MB,
          `Max size must be at most ${MAX_SERVICE_UPLOAD_LIMIT_MB} MB.`,
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
      (field) => new Set(field.options.map(labelKey)).size === field.options.length,
      'Choices must be different.',
    ),
    ['options'],
  ),
);

/** Labels that repeat the name and email every request form already asks for. */
const BUILT_IN_LABELS = new Set(['name', 'email', 'email address']);

function labelKey(label: string) {
  return label.trim().toLowerCase();
}

/** True for labels like `E-mail`, `Your email address` or `Customer name`. */
function isBuiltInLabel(label: string) {
  const words = labelKey(label)
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean);
  while (['your', 'customer', 'full'].includes(words[0])) words.shift();
  return BUILT_IN_LABELS.has(words.join(' '));
}

/** Reports a label that repeats another field's or a built-in one, at that field's label. */
const uniqueLabels = v.rawCheck<v.InferOutput<typeof serviceFieldDto>[]>(
  ({ dataset, addIssue }) => {
    if (!dataset.typed) return;
    const seen = new Set<string>();
    dataset.value.forEach((field, index) => {
      const key = labelKey(field.label);
      const builtIn = isBuiltInLabel(field.label);
      if (builtIn || seen.has(key)) {
        addIssue({
          message: builtIn
            ? 'Customers already give their name and email.'
            : 'Each field needs a different label.',
          path: [
            { type: 'array', origin: 'value', input: dataset.value, key: index, value: field },
            { type: 'object', origin: 'value', input: field, key: 'label', value: field.label },
          ],
        });
      }
      // Empty labels already report their own error.
      if (key) seen.add(key);
    });
  },
);

export const upsertServiceDto = v.object({
  id: v.optional(v.string()),
  name: v.pipe(v.string(), v.trim(), v.minLength(1, 'Enter a service name.')),
  description: v.pipe(v.string(), v.trim(), v.minLength(1, 'Enter a description.')),
  pricingMode: v.picklist(enumValues(SERVICE_PRICING)),
  price: v.pipe(v.number(), v.integer(), v.minValue(0)), // in cents; 0 is free
  fields: v.pipe(
    v.array(serviceFieldDto),
    v.check(
      (fields) => new Set(fields.map((field) => field.id)).size === fields.length,
      'Field ids must be unique.',
    ),
    uniqueLabels,
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
