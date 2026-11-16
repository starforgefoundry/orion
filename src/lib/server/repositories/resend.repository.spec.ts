import { describe, expect, it, vi } from 'vitest';
import { ResendRateLimitError, ResendRepository, retryAfter } from './resend.repository';

describe('ResendRepository.send', () => {
  const SENDER = { from: 'Prints <prints@example.com>', replyTo: 'prints@example.com' };
  const EMAIL = { to: 'a@b.com', sender: SENDER, subject: 'Ready', html: '<b>Done</b>' };

  function setup(response = new Response()) {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => response);
    vi.stubGlobal('fetch', fetch);
    return { fetch, repository: new ResendRepository() };
  }

  it('sends from the sender, with replies going to its address', async () => {
    const { fetch, repository } = setup();

    await repository.send(EMAIL);

    expect(fetch.mock.calls[0][0]).toBe('https://api.resend.com/emails');
    expect(JSON.parse(fetch.mock.calls[0][1]?.body as string)).toEqual({
      from: 'Prints <prints@example.com>',
      to: ['a@b.com'],
      reply_to: 'prints@example.com',
      subject: 'Ready',
      html: '<b>Done</b>',
    });
  });

  it('reports the Resend error message', async () => {
    const { repository } = setup(
      Response.json({ message: 'The from domain is not verified' }, { status: 403 }),
    );

    await expect(repository.send(EMAIL)).rejects.toThrow(
      'Failed to send email via Resend: The from domain is not verified',
    );
  });

  it('raises a rate limit error that waits as long as Resend asks', async () => {
    const { repository } = setup(
      Response.json(
        { message: 'Too many requests' },
        { status: 429, headers: { 'retry-after': '30' } },
      ),
    );

    const error = await repository.send(EMAIL).catch((error: unknown) => error);

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
