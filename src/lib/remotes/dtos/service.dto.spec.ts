import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import {
  submitServiceRequestDto,
  upsertServiceDto,
  type UpsertServiceDto,
} from '$lib/remotes/dtos/service.dto';
import type { ServiceField } from '$lib/utils/services';

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

function issuesOf(input: UpsertServiceDto) {
  return (v.safeParse(upsertServiceDto, input).issues ?? []).map((issue) => [
    v.getDotPath(issue),
    issue.message,
  ]);
}

describe('upsertServiceDto', () => {
  it('accepts a free fixed price', () => {
    expect(issuesOf(service)).toEqual([]);
  });

  it('reports field problems at the field input they belong to', () => {
    expect(
      issuesOf({
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
      ['fields.1.label', 'Each field needs a different label.'],
    ]);
  });

  it('rejects repeated choices and labels, ignoring case', () => {
    expect(
      issuesOf({
        ...service,
        fields: [
          { ...field, type: 'select', options: ['Oak', 'Walnut', 'oak'] },
          { ...field, id: 'f2', label: ' material ' },
          { ...field, id: 'f3', label: 'Email Address' },
        ],
      }),
    ).toEqual([
      ['fields.0.options', 'Choices must be different.'],
      ['fields.1.label', 'Each field needs a different label.'],
      ['fields.2.label', 'Customers already give their name and email.'],
    ]);
  });

  it.each(['E-mail', 'Your email address', 'Customer name', 'Your full name', ' NAME. '])(
    'rejects the built-in label %j',
    (label) => {
      expect(issuesOf({ ...service, fields: [{ ...field, label }] })).toEqual([
        ['fields.0.label', 'Customers already give their name and email.'],
      ]);
    },
  );

  it.each(['Name on the tag', 'Email me a proof', 'Customer notes'])(
    'accepts the label %j',
    (label) => {
      expect(issuesOf({ ...service, fields: [{ ...field, label }] })).toEqual([]);
    },
  );
});

describe('submitServiceRequestDto email', () => {
  const email = (value: string) =>
    v.safeParse(submitServiceRequestDto.entries.email, value).issues?.[0].message;

  it('asks for a missing email before checking its format', () => {
    expect(email('  ')).toBe('Enter your email address.');
    expect(email('john@')).toBe('Enter a valid email address.');
    expect(email('john@example.com')).toBeUndefined();
  });
});
