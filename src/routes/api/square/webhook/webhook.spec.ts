import { HTTP_STATUS } from '$lib/http';
import { squareService } from '$lib/server/services/square.service';
import { SQUARE_SIGNATURE_HEADER, squareWebhookUrl } from '$lib/server/utils/square';
import { isHttpError } from '@sveltejs/kit';
import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './+server';

vi.mock('$lib/server/services/square.service', () => ({
  squareService: { processWebhook: vi.fn() },
}));

const SIGNATURE_KEY = 'test-signature-key';
const WEBHOOK = { event_id: 'event-1', type: 'subscription.updated', data: { id: 'sub-1' } };
const BODY = JSON.stringify(WEBHOOK);

function sign(body: string) {
  return createHmac('sha256', SIGNATURE_KEY)
    .update(squareWebhookUrl() + body)
    .digest('base64');
}

function post(body: string, signature?: string) {
  const headers = new Headers(signature ? { [SQUARE_SIGNATURE_HEADER]: signature } : {});
  const request = new Request(squareWebhookUrl(), { method: 'POST', body, headers });
  return POST({ request } as Parameters<typeof POST>[0]);
}

async function caught(action: () => unknown) {
  try {
    await action();
  } catch (error) {
    return error;
  }
  throw new Error('Expected the action to throw');
}

describe('POST /api/square/webhook', () => {
  beforeEach(() => {
    vi.stubEnv('SQUARE_WEBHOOK_SIGNATURE_KEY', SIGNATURE_KEY);
    vi.mocked(squareService.processWebhook).mockResolvedValue({ success: true });
  });

  it('rejects a request without a signature', async () => {
    const error = await caught(() => post(BODY));

    expect(isHttpError(error, HTTP_STATUS.UNAUTHORIZED)).toBe(true);
    expect(squareService.processWebhook).not.toHaveBeenCalled();
  });

  it('rejects a signature made for a different body', async () => {
    const error = await caught(() => post(BODY, sign('{}')));

    expect(isHttpError(error, HTTP_STATUS.UNAUTHORIZED)).toBe(true);
    expect(squareService.processWebhook).not.toHaveBeenCalled();
  });

  it('processes a signed webhook and returns the result', async () => {
    const response = await post(BODY, sign(BODY));

    expect(squareService.processWebhook).toHaveBeenCalledWith(WEBHOOK);
    expect(await response.json()).toEqual({ success: true });
  });
});
