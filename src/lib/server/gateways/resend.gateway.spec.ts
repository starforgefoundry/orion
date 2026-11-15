import { EmailTemplateRepository } from '$lib/server/repositories/email-template.repository';
import { automock } from '$test/utils';
import { describe, expect, it, vi } from 'vitest';
import { ResendGateway, ResendRateLimitError, retryAfter } from './resend.gateway';

describe('ResendGateway.sendTemplate', () => {
  function setup(template?: { subject: string; body: string }, response = new Response()) {
    const templates = automock(EmailTemplateRepository);
    templates.get.mockResolvedValue(
      template ? { key: 'print_pickup', ...template } : (undefined as never),
    );
    const fetch = vi.fn<typeof globalThis.fetch>(async () => response);
    vi.stubGlobal('fetch', fetch);
    return { fetch, gateway: new ResendGateway(templates) };
  }

  function sentBody(fetch: ReturnType<typeof setup>['fetch']) {
    return JSON.parse(fetch.mock.calls[0][1]?.body as string);
  }

  const VARIABLES = { projectName: 'Robot Arm', paymentNote: 'Paid.', statusURL: 'https://x' };
  const SENDER = { from: 'Prints <prints@example.com>', replyTo: 'prints@example.com' };

  it('fills the stored subject and body', async () => {
    const { fetch, gateway } = setup({
      subject: 'Ready - {{projectName}}',
      body: '<a href="{{statusURL}}">{{projectName}}</a>',
    });

    await gateway.sendTemplate('a@b.com', SENDER, 'print_pickup', VARIABLES);

    expect(sentBody(fetch)).toMatchObject({
      subject: 'Ready - Robot Arm',
      html: '<a href="https://x">Robot Arm</a>',
    });
  });

  it('sends from the sender, with replies going to its address', async () => {
    const { fetch, gateway } = setup({ subject: 'Ready', body: 'Done' });

    await gateway.sendTemplate('a@b.com', SENDER, 'print_pickup', VARIABLES);

    expect(fetch.mock.calls[0][0]).toBe('https://api.resend.com/emails');
    expect(sentBody(fetch)).toMatchObject({
      from: 'Prints <prints@example.com>',
      to: ['a@b.com'],
      reply_to: 'prints@example.com',
    });
  });

  it('escapes customer-supplied values in the HTML body only', async () => {
    const { fetch, gateway } = setup({ subject: '{{projectName}}', body: '{{projectName}}' });

    await gateway.sendTemplate('a@b.com', SENDER, 'print_pickup', {
      ...VARIABLES,
      projectName: '<b>Arm</b>',
    });

    expect(sentBody(fetch)).toMatchObject({
      subject: '<b>Arm</b>',
      html: '&lt;b&gt;Arm&lt;/b&gt;',
    });
  });

  it('fails when the template is missing from the database', async () => {
    const { fetch, gateway } = setup();

    await expect(
      gateway.sendTemplate('a@b.com', SENDER, 'print_pickup', VARIABLES),
    ).rejects.toThrow('Email template "print_pickup" not found');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reports the Resend error message', async () => {
    const { gateway } = setup(
      { subject: 'Ready', body: 'Done' },
      Response.json({ message: 'The from domain is not verified' }, { status: 403 }),
    );

    await expect(
      gateway.sendTemplate('a@b.com', SENDER, 'print_pickup', VARIABLES),
    ).rejects.toThrow('Failed to send email via Resend: The from domain is not verified');
  });

  it('raises a rate limit error that waits as long as Resend asks', async () => {
    const { gateway } = setup(
      { subject: 'Ready', body: 'Done' },
      Response.json(
        { message: 'Too many requests' },
        { status: 429, headers: { 'retry-after': '30' } },
      ),
    );

    const error = await gateway
      .sendTemplate('a@b.com', SENDER, 'print_pickup', VARIABLES)
      .catch((error: unknown) => error);

    expect(error).toBeInstanceOf(ResendRateLimitError);
    expect((error as ResendRateLimitError).retryAt.diffNow().as('seconds')).toBeCloseTo(30, 0);
  });
});

describe('retryAfter', () => {
  it('waits the number of seconds Resend sends back', () => {
    expect(retryAfter('2').diffNow().as('seconds')).toBeCloseTo(2, 0);
  });

  it('waits a minute when Resend sends no wait time', () => {
    expect(retryAfter(null).diffNow().as('seconds')).toBeCloseTo(60, 0);
  });
});
