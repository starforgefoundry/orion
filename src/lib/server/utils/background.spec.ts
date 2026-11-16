import { afterEach, describe, expect, it, vi } from 'vitest';
import { forEachSettled, runEvery } from './background';

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

describe(runEvery.name, () => {
  const INTERVAL_MS = 1000;

  afterEach(() => {
    vi.useRealTimers();
  });

  it('skips a tick while the previous run is still going', async () => {
    vi.useFakeTimers();
    let finish = () => {};
    const task = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const timer = runEvery(INTERVAL_MS, 'test task', task);

    await vi.advanceTimersByTimeAsync(INTERVAL_MS * 3);
    expect(task).toHaveBeenCalledOnce();

    finish();
    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    expect(task).toHaveBeenCalledTimes(2);
    clearInterval(timer);
  });
});
