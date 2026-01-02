import { vi } from 'vitest';

/**
 * Creates a mock request event for testing purposes
 */
export function createMockRequestEvent() {
  return {
    platform: {
      ctx: {
        waitUntil: vi.fn(),
      },
    },
  };
}
