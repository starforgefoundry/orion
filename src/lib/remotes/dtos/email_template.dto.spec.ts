import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { updateEmailTemplateDto } from '$lib/remotes/dtos/email_template.dto';

describe('updateEmailTemplateDto', () => {
  it('accepts a template that only uses its own variables', () => {
    const result = v.safeParse(updateEmailTemplateDto, {
      key: 'print_pickup',
      subject: 'Ready - {{projectName}}',
      body: '<a href="{{statusURL}}">x</a>',
    });

    expect(result.success).toBe(true);
  });

  it('rejects variables the template does not provide', () => {
    const result = v.safeParse(updateEmailTemplateDto, {
      key: 'print_pickup',
      subject: '{{quotePrice}}',
      body: 'body',
    });

    expect(result.issues?.map((issue) => issue.message)).toEqual([
      'Unknown variables: {{quotePrice}}',
    ]);
  });
});
