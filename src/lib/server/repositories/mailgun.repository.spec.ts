import { EmailTemplateRepository } from '$lib/server/repositories/email_template.repository';
import { automock } from '$test/utils';
import { DateTime } from 'luxon';
import { describe, expect, it, vi } from 'vitest';
import { MailgunRepository, retryAfter } from './mailgun.repository';

describe('MailgunRepository.sendTemplate', () => {
  function setup(template?: { subject: string; body: string }) {
    const templates = automock(EmailTemplateRepository);
    templates.get.mockResolvedValue(
      template ? { key: 'print_pickup', ...template } : (undefined as never),
    );
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response());
    vi.stubGlobal('fetch', fetch);
    return { fetch, repository: new MailgunRepository(templates) };
  }

  const VARIABLES = { projectName: 'Robot Arm', paymentNote: 'Paid.', statusURL: 'https://x' };

  it('fills the stored subject and body', async () => {
    const { fetch, repository } = setup({
      subject: 'Ready - {{projectName}}',
      body: '<a href="{{statusURL}}">{{projectName}}</a>',
    });

    await repository.sendTemplate('a@b.com', 'from', 'reply', 'print_pickup', VARIABLES);

    const body = fetch.mock.calls[0][1]?.body as URLSearchParams;
    expect(body.get('subject')).toBe('Ready - Robot Arm');
    expect(body.get('html')).toBe('<a href="https://x">Robot Arm</a>');
  });

  it('fails when the template is missing from the database', async () => {
    const { fetch, repository } = setup();

    await expect(
      repository.sendTemplate('a@b.com', 'from', 'reply', 'print_pickup', VARIABLES),
    ).rejects.toThrow('Email template "print_pickup" not found');
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('retryAfter', () => {
  it('reads the reset time from the Mailgun limit message', () => {
    const retryAt = retryAfter(
      'Domain starforgefoundry.com is not allowed to send: recipient limit (26) exceeded, try again after Thu, 22 Oct 2026 00:27:54 UTC',
    );

    expect(retryAt.toUTC().toISO()).toBe('2026-10-22T00:27:54.000Z');
  });

  it('waits a minute when the message has no reset time', () => {
    const retryAt = retryAfter('Too many requests');

    expect(retryAt.diffNow().as('seconds')).toBeCloseTo(60, 0);
  });
});
