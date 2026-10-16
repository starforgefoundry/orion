import { MEMBER_STATUS, type MemberStatus } from '$lib/remotes/dtos/member.dto';
import { searchMembers } from '$lib/remotes/endpoints/member.remote';

const SEARCH_DEBOUNCE_MS = 300;

export class MembersManager {
  searchTerm = $state('');
  status = $state<MemberStatus>(MEMBER_STATUS.ACTIVE);
  page = $state(1);

  private query = $state('');
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;

  results = $derived(searchMembers({ query: this.query, status: this.status, page: this.page }));

  setSearchTerm(value: string) {
    this.searchTerm = value;
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.query = value;
      this.page = 1;
    }, SEARCH_DEBOUNCE_MS);
  }

  setStatus(status: MemberStatus) {
    this.status = status;
    this.page = 1;
  }

  setPage(page: number) {
    this.page = page;
  }
}
