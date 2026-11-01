import { goto } from '$app/navigation';
import { DebouncedSearch } from '$lib/frontend/debounced-search.svelte';
import { searchWaivers } from '$lib/remotes/endpoints/waiver.remote';

export const WAIVERS_PAGE_SIZE = 25;
const FIRST_PAGE = 1;

export class WaiverDirectory {
  page = $state(FIRST_PAGE);
  readonly search = new DebouncedSearch(() => (this.page = FIRST_PAGE));

  readonly results = $derived(
    searchWaivers({ query: this.search.query, page: this.page, pageSize: WAIVERS_PAGE_SIZE }),
  );

  get totalPages() {
    return this.results.current?.pagination.totalPages ?? FIRST_PAGE;
  }

  get hasPreviousPage() {
    return this.page > FIRST_PAGE;
  }

  get hasNextPage() {
    return !!this.results.current && this.page < this.totalPages;
  }

  previousPage() {
    if (this.hasPreviousPage) this.page--;
  }

  nextPage() {
    if (this.hasNextPage) this.page++;
  }

  viewWaiver(waiverId: string) {
    window.open(`/staff/waivers/view/${waiverId}`, '_blank');
  }

  viewMember(memberId: string) {
    goto(`/staff/members/${memberId}`);
  }
}
