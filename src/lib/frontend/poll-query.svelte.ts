export const POLL_INTERVAL_MS = 5000;

type RefreshableQuery = { refresh(): Promise<void> };

type PollOptions = {
  intervalMs?: number;
  isPaused?: () => boolean;
};

/** Keeps a query fresh while the tab is visible, and catches up as soon as the tab comes back. Call during component init. */
export function pollQuery(
  getQuery: () => RefreshableQuery,
  { intervalMs = POLL_INTERVAL_MS, isPaused = () => false }: PollOptions = {},
) {
  $effect(() => {
    const query = getQuery();

    const refresh = () => {
      if (document.visibilityState !== 'visible' || isPaused()) return;
      void query.refresh();
    };

    const timer = setInterval(refresh, intervalMs);
    document.addEventListener('visibilitychange', refresh);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  });
}
