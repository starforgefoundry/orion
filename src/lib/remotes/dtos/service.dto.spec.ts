import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import {
  serviceRequestSchema,
  submitServiceRequestDto,
  upsertServiceDto,
  type UpsertServiceDto,
} from '$lib/remotes/dtos/service.dto';
import { MAX_SERVICE_UPLOAD_TOTAL_MB, type ServiceField } from '$lib/utils/services';

const service: UpsertServiceDto = {
  name: 'Engraving',
  description: 'Engrave things',
  pricingMode: 'fixed',
  price: 0,
  enabled: true,
  fields: [],
};
const field: ServiceField = {
  id: 'f1',
  label: 'Material',
  type: 'text',
  required: false,
  options: [],
};

function issuesOf(schema: v.GenericSchema, input: unknown) {
  return (v.safeParse(schema, input).issues ?? []).map((issue) => [
    v.getDotPath(issue),
    issue.message,
  ]);
}

describe('upsertServiceDto', () => {
  it('accepts a free fixed price', () => {
    expect(issuesOf(upsertServiceDto, service)).toEqual([]);
  });

  it('reports field problems at the field input they belong to', () => {
    expect(
      issuesOf(upsertServiceDto, {
        ...service,
        fields: [
          { ...field, type: 'select' },
          { ...field, id: 'f2', type: 'file', fileTypes: ['pdf files'], maxUploadMB: NaN },
        ],
      }),
    ).toEqual([
      ['fields.0.options', 'Enter at least one choice.'],
      ['fields.1.fileTypes.0', '“pdf files” is not a file type. Use extensions like pdf or svg.'],
      ['fields.1.maxUploadMB', 'Enter a max size in MB.'],
    ]);
  });

  it('rejects repeated choices, ignoring case', () => {
    expect(
      issuesOf(upsertServiceDto, {
        ...service,
        fields: [{ ...field, type: 'select', options: ['Oak', 'Walnut', 'oak'] }],
      }),
    ).toEqual([['fields.0.options', 'Choices must be different.']]);
  });

  it('caps the combined size of file fields', () => {
    const file = { ...field, type: 'file' as const, maxUploadMB: MAX_SERVICE_UPLOAD_TOTAL_MB };
    expect(
      issuesOf(upsertServiceDto, { ...service, fields: [file, { ...file, id: 'f2' }] }),
    ).toEqual([
      ['fields', `File fields can allow at most ${MAX_SERVICE_UPLOAD_TOTAL_MB} MB combined.`],
    ]);
  });
});

describe('submitServiceRequestDto email', () => {
  it('asks for a missing email before checking its format', () => {
    const email = (value: string) =>
      v.safeParse(submitServiceRequestDto.entries.email, value).issues?.[0].message;
    expect(email('  ')).toBe('Enter your email address.');
    expect(email('john@')).toBe('Enter a valid email address.');
    expect(email('john@example.com')).toBeUndefined();
  });
});

describe('serviceRequestSchema', () => {
  const request = { serviceId: 's1', customerName: 'Jane', email: 'jane@example.com' };
  const schema = serviceRequestSchema([
    { ...field, required: true },
    { ...field, id: 'f2', label: 'Quantity', type: 'number' },
  ]);

  it('reports answer problems at the answer they belong to', () => {
    expect(issuesOf(schema, { ...request, answers: { f2: 'x' } })).toEqual([
      ['answers.f1', 'Material is required.'],
      ['answers.f2', 'Quantity must be a number.'],
    ]);
  });

  it('accepts valid answers and skips empty optional ones', () => {
    expect(issuesOf(schema, { ...request, answers: { f1: 'Oak' } })).toEqual([]);
  });
});
