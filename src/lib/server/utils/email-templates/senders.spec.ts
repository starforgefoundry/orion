import { describe, expect, it, vi } from 'vitest';
import { SENDERS } from './senders';

describe('SENDERS', () => {
  it('replies to the address it sends from', () => {
    expect(SENDERS.classes.from).toContain(`<${SENDERS.classes.replyTo}>`);
  });

  it('reads the print address when the sender is used', () => {
    vi.stubEnv('PUBLIC_PRINT_REQUEST_EMAIL', 'new-prints@example.com');

    expect(SENDERS.print).toEqual({
      from: 'Starforge 3D Prints <new-prints@example.com>',
      replyTo: 'new-prints@example.com',
    });
  });
});
