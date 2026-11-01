import { goto } from '$app/navigation';
import { SEARCH_DEBOUNCE_MS } from '$lib/frontend/debounced-search.svelte';
import { searchWaivers } from '$lib/remotes/endpoints/waiver.remote';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WAIVERS_PAGE_SIZE, WaiverDirectory } from './waivers.svelte';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

vi.mock('$lib/remotes/endpoints/waiver.remote', () => ({ searchWaivers: vi.fn() }));

const TOTAL_PAGES = 3;

describe(WaiverDirectory.name, () => {
  beforeEach(() => {
    vi.mocked(searchWaivers).mockReturnValue({
      current: { data: [], pagination: { page: 1, totalPages: TOTAL_PAGES } },
    } as unknown as ReturnType<typeof searchWaivers>);
  });

  it('pages forward and back within the results', () => {
    const directory = new WaiverDirectory();

    expect(directory.hasPreviousPage).toBe(false);
    directory.previousPage();
    expect(directory.page).toBe(1);

    directory.nextPage();
    directory.nextPage();
    directory.nextPage();
    expect(directory.page).toBe(TOTAL_PAGES);
    expect(directory.hasNextPage).toBe(false);

    directory.previousPage();
    expect(directory.page).toBe(TOTAL_PAGES - 1);
  });

  it('searches from the first page', () => {
    vi.useFakeTimers();
    const directory = new WaiverDirectory();
    directory.nextPage();

    directory.search.term = 'smith';
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);

    expect(directory.page).toBe(1);
    expect(directory.results).toBeDefined();
    expect(searchWaivers).toHaveBeenLastCalledWith({
      query: 'smith',
      page: 1,
      pageSize: WAIVERS_PAGE_SIZE,
    });
  });

  it('opens the member page', () => {
    const directory = new WaiverDirectory();

    directory.viewMember('member-1');

    expect(goto).toHaveBeenCalledWith('/staff/members/member-1');
  });
});
