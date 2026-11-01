export const SEARCH_DEBOUNCE_MS = 300;

/** A search box whose `query` follows the typed `term` once typing pauses. */
export class DebouncedSearch {
  query = $state('');

  #term = $state('');
  #timer: ReturnType<typeof setTimeout> | undefined;

  /** `onCommit` runs whenever `query` changes, e.g. to go back to the first page. */
  constructor(private readonly onCommit: () => void = () => {}) {}

  get term() {
    return this.#term;
  }

  set term(value: string) {
    this.#term = value;
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => this.commit(), SEARCH_DEBOUNCE_MS);
  }

  /** Searches for the typed term now instead of waiting. */
  commit() {
    clearTimeout(this.#timer);
    if (this.query === this.#term) return;

    this.query = this.#term;
    this.onCommit();
  }
}
