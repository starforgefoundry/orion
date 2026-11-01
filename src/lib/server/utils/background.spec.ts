import { afterEach, describe, expect, it, vi } from 'vitest';
import { forEachSettled } from './background';

describe(forEachSettled.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps going after an item fails and logs the failure', async () => {
    const failure = new Error('mail server down');
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const action = vi.fn(async (item: string) => {
      if (item === 'b') throw failure;
    });

    await forEachSettled(['a', 'b', 'c'], action, (item) => `send ${item}`);

    expect(action.mock.calls.map(([item]) => item)).toEqual(['a', 'b', 'c']);
    expect(logged).toHaveBeenCalledExactlyOnceWith('Failed to send b:', failure);
  });
});
