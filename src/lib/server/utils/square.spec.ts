import { beforeEach, describe, expect, it, vi } from 'vitest';

const { env } = vi.hoisted(() => ({ env: {} as Record<string, string | undefined> }));

vi.mock('$env/dynamic/private', () => ({ env }));

import { squareApiUrl, squareWebSdkUrl, squareWebhookUrl } from './square';

beforeEach(() => {
  for (const key of Object.keys(env)) delete env[key];
});

describe('squareApiUrl', () => {
  it('defaults to production', () => {
    expect(squareApiUrl()).toBe('https://connect.squareup.com');
  });
});

describe('squareWebSdkUrl', () => {
  it('loads the sandbox SDK when the API points at the sandbox', () => {
    env.SQUARE_URL = 'https://connect.squareupsandbox.com';

    expect(squareWebSdkUrl()).toBe('https://sandbox.web.squarecdn.com/v1/square.js');
  });

  it('loads the production SDK otherwise', () => {
    env.SQUARE_URL = 'https://connect.squareup.com';

    expect(squareWebSdkUrl()).toBe('https://web.squarecdn.com/v1/square.js');
  });
});

describe('squareWebhookUrl', () => {
  it('is the webhook route on the frontend URL', () => {
    env.FRONTEND_URL = 'https://orion.example.com';

    expect(squareWebhookUrl()).toBe('https://orion.example.com/api/square/webhook');
  });
});
