import { describe, expect, it, vi } from 'vitest';
import { DebouncedSearch, SEARCH_DEBOUNCE_MS } from './debounced-search.svelte';

describe(DebouncedSearch.name, () => {
  it('updates the query once typing pauses', () => {
    vi.useFakeTimers();
    const onCommit = vi.fn();
    const search = new DebouncedSearch(onCommit);

    search.term = 'a';
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1);
    search.term = 'ab';
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1);
    expect(search.query).toBe('');

    vi.advanceTimersByTime(1);
    expect(search.query).toBe('ab');
    expect(onCommit).toHaveBeenCalledOnce();
  });

  it('commits immediately on request', () => {
    vi.useFakeTimers();
    const onCommit = vi.fn();
    const search = new DebouncedSearch(onCommit);

    search.term = 'drill';
    search.commit();
    expect(search.query).toBe('drill');

    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    expect(onCommit).toHaveBeenCalledOnce();
  });

  it('does not commit an unchanged query', () => {
    const onCommit = vi.fn();
    const search = new DebouncedSearch(onCommit);

    search.commit();

    expect(onCommit).not.toHaveBeenCalled();
  });
});
