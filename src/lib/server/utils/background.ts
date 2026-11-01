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
