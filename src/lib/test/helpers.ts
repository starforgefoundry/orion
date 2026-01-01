import { vi } from 'vitest';

/**
 * Mock for the request event context
 */
export function createMockRequestEvent(overrides?: {
  platform?: { ctx?: { waitUntil: (promise: Promise<any>) => void } };
}) {
  return {
    platform: {
      ctx: {
        waitUntil: vi.fn(),
      },
      ...overrides?.platform,
    },
  };
}

/**
 * Mock for getRequestEvent function from $app/server
 */
export function mockGetRequestEvent(event: any) {
  return vi.fn(() => event);
}

/**
 * Mock for verifyAuth function
 */
export function mockVerifyAuth() {
  return vi.fn(() => true);
}
