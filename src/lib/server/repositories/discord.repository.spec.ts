import { afterEach, describe, expect, it, vi } from 'vitest';
import { DISCORD_COLOR, DiscordRepository, type DiscordMessage } from './discord.repository';

const WEBHOOK_URL = 'https://discord.com/api/webhooks/test';
const MESSAGE: DiscordMessage = {
  content: 'Hello',
  embeds: [{ title: 'Test', color: DISCORD_COLOR.GREEN, fields: [], timestamp: 'now' }],
};

describe('DiscordRepository.notify', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function stubFetch(response = new Response()) {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => response);
    vi.stubGlobal('fetch', fetch);
    return fetch;
  }

  it('posts the message to the webhook', async () => {
    const fetch = stubFetch();

    await new DiscordRepository().notify(WEBHOOK_URL, MESSAGE);

    expect(fetch).toHaveBeenCalledExactlyOnceWith(
      WEBHOOK_URL,
      expect.objectContaining({ method: 'POST', body: JSON.stringify(MESSAGE) }),
    );
  });

  it('skips the message when no webhook is set up', async () => {
    const fetch = stubFetch();
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await new DiscordRepository().notify('', MESSAGE);

    expect(fetch).not.toHaveBeenCalled();
  });

  it('fails when Discord rejects the message', async () => {
    stubFetch(new Response(null, { status: 400, statusText: 'Bad Request' }));

    await expect(new DiscordRepository().notify(WEBHOOK_URL, MESSAGE)).rejects.toThrow(
      'Failed to send Discord webhook: Bad Request',
    );
  });
});
