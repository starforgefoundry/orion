export function runInBackground(promise: Promise<unknown>, label: string): void {
  promise.catch((error) => {
    console.error(`Background task failed (${label}):`, error);
  });
}

/** Runs `action` on each item in turn, logging a failure and moving on to the next item. */
export async function forEachSettled<T>(
  items: T[],
  action: (item: T) => Promise<unknown>,
  describe: (item: T) => string,
) {
  for (const item of items) {
    try {
      await action(item);
    } catch (error) {
      console.error(`Failed to ${describe(item)}:`, error);
    }
  }
}

/** Runs `task` every `intervalMs`, skipping a tick while the previous run is still going. */
export function runEvery(intervalMs: number, label: string, task: () => Promise<unknown>) {
  let running: Promise<unknown> | null = null;
  const timer = setInterval(() => {
    if (running) return;
    running = task()
      .catch((error) => console.error(`Background task failed (${label}):`, error))
      .finally(() => {
        running = null;
      });
  }, intervalMs);
  timer.unref();
  return timer;
}
