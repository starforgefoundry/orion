import { errorDescription } from '$lib/frontend/form-submit';
import { modalManager } from '$lib/frontend/modal-manager.svelte';
import { ACCESS_BASIS, type AccessBasis } from '$lib/member_enums';
import {
  MEMBER_SORT,
  SORT_DIRECTION,
  type MemberSort,
  type OnboardingFilter,
  type SortDirection,
  type WaiverFilter,
} from '$lib/member_enums';
import { searchMembers, sendMemberOnboardings } from '$lib/remotes/endpoints/member.remote';
import { DebouncedSearch } from '$lib/frontend/debounced-search.svelte';
import { TableSelection } from '$lib/frontend/table-selection.svelte';
import { toast } from 'svelte-sonner';

export type MemberFilters = {
  access: AccessBasis[];
  waiver: WaiverFilter[];
  onboarding: OnboardingFilter[];
};

export type FilterKey = keyof MemberFilters;

/** Matches the old "Active" default: members with a subscription or organization. */
const DEFAULT_FILTERS: MemberFilters = {
  access: [ACCESS_BASIS.SUBSCRIPTION, ACCESS_BASIS.ORGANIZATION],
  waiver: [],
  onboarding: [],
};

const EMPTY_FILTERS: MemberFilters = { access: [], waiver: [], onboarding: [] };

export class MemberDirectory {
  search = new DebouncedSearch(() => this.resetPage());
  filters = $state<MemberFilters>(structuredClone(DEFAULT_FILTERS));
  sort = $state<MemberSort>(MEMBER_SORT.NAME);
  direction = $state<SortDirection>(SORT_DIRECTION.ASC);
  page = $state(1);
  selected = new TableSelection(
    () => this.rows,
    (row) => row.member.id,
  );
  sending = $state(false);

  results = $derived(
    searchMembers({
      query: this.search.query,
      ...this.filters,
      sort: this.sort,
      direction: this.direction,
      page: this.page,
    }),
  );

  get rows() {
    return this.results.current?.data ?? [];
  }

  get hasFilters() {
    return Object.values(this.filters).some((values) => values.length > 0);
  }

  isFiltered<K extends FilterKey>(key: K, value: MemberFilters[K][number]) {
    return (this.filters[key] as string[]).includes(value);
  }

  toggleFilter<K extends FilterKey>(key: K, value: MemberFilters[K][number], checked: boolean) {
    const values = this.filters[key] as string[];
    this.filters[key] = (
      checked ? [...values, value] : values.filter((v) => v !== value)
    ) as MemberFilters[K];
    this.resetPage();
  }

  clearFilter(key: FilterKey) {
    this.filters[key] = [];
    this.resetPage();
  }

  clearFilters() {
    this.filters = structuredClone(EMPTY_FILTERS);
    this.resetPage();
  }

  sortBy(sort: MemberSort, direction: SortDirection) {
    this.sort = sort;
    this.direction = direction;
    this.resetPage();
  }

  sortDirection(sort: MemberSort) {
    return this.sort === sort ? this.direction : undefined;
  }

  setPage(page: number) {
    this.page = page;
    this.selected.clear();
  }

  async sendOnboardingToSelected() {
    const memberIds = this.selected.selectedIds;
    const confirmed = await modalManager.confirm({
      title: 'Send Onboarding Emails',
      prompt: `Send the onboarding email to ${memberIds.length} members?`,
      confirmText: 'Send',
    });
    if (!confirmed) return;

    this.sending = true;
    try {
      const { sent, failed } = await sendMemberOnboardings(memberIds);
      if (sent.length) toast.success(`Sent ${sent.length} onboarding emails`);
      if (failed.length) {
        toast.error('Some onboarding emails failed', { description: failed.join(', ') });
      }
      this.selected.clear();
      await this.results.refresh();
    } catch (error) {
      toast.error('Failed to send onboarding emails', { description: errorDescription(error) });
    } finally {
      this.sending = false;
    }
  }

  private resetPage() {
    this.setPage(1);
  }
}
