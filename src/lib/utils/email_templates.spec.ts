import { describe, expect, it } from 'vitest';
import { renderTemplate, unknownVariables } from './email_templates';

describe('renderTemplate', () => {
  it('fills every occurrence of a variable', () => {
    expect(renderTemplate('{{name}} and {{name}}', { name: 'Robot Arm' })).toBe(
      'Robot Arm and Robot Arm',
    );
  });

  it('allows spaces inside the braces', () => {
    expect(renderTemplate('Hi {{ name }}!', { name: 'Jane' })).toBe('Hi Jane!');
  });

  it('leaves variables it was not given untouched', () => {
    expect(renderTemplate('Hi {{missing}}', {})).toBe('Hi {{missing}}');
  });

  it('inserts values containing $ literally', () => {
    expect(renderTemplate('Total: {{total}}', { total: "$& $1 $'" })).toBe("Total: $& $1 $'");
  });
});

describe('unknownVariables', () => {
  it('accepts the variables the template documents', () => {
    expect(
      unknownVariables('print_pickup', { subject: '{{projectName}}', body: '{{ statusURL }}' }),
    ).toEqual([]);
  });

  it('lists each variable the template does not know once across subject and body', () => {
    expect(
      unknownVariables('print_pickup', {
        subject: '{{customerName}}',
        body: '{{customerName}} {{typo}}',
      }),
    ).toEqual(['customerName', 'typo']);
  });
});
