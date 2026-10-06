export function runInBackground(promise: Promise<unknown>, label: string): void {
  promise.catch((error) => {
    console.error(`Background task failed (${label}):`, error);
  });
}
