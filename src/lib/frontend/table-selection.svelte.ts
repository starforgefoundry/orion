import { SvelteSet } from 'svelte/reactivity';

/** Checkbox selection over table rows, with shift-click range selection. */
export class TableSelection<T> {
  private readonly ids = new SvelteSet<string>();
  private anchorId: string | undefined;

  constructor(
    private readonly rows: () => T[],
    private readonly key: (row: T) => string,
  ) {}

  get size() {
    return this.ids.size;
  }

  get selectedIds() {
    return [...this.ids];
  }

  get selectedRows() {
    return this.rows().filter((row) => this.has(row));
  }

  get allSelected() {
    const rows = this.rows();
    return rows.length > 0 && rows.every((row) => this.has(row));
  }

  get someSelected() {
    return this.ids.size > 0 && !this.allSelected;
  }

  has(row: T) {
    return this.ids.has(this.key(row));
  }

  /** With `range`, applies `checked` to every row between the last toggled row and this one. */
  toggle(row: T, checked: boolean, range = false) {
    const id = this.key(row);
    const affected = range ? this.rangeTo(id) : [id];
    affected.forEach((rowId) => (checked ? this.ids.add(rowId) : this.ids.delete(rowId)));
    this.anchorId = id;
  }

  toggleAll(checked: boolean) {
    this.ids.clear();
    if (checked) this.rows().forEach((row) => this.ids.add(this.key(row)));
  }

  deselect(ids: string[]) {
    ids.forEach((id) => this.ids.delete(id));
  }

  clear() {
    this.ids.clear();
    this.anchorId = undefined;
  }

  private rangeTo(id: string) {
    const ids = this.rows().map(this.key);
    const anchor = this.anchorId === undefined ? -1 : ids.indexOf(this.anchorId);
    const target = ids.indexOf(id);
    if (anchor === -1 || target === -1) return [id];

    return ids.slice(Math.min(anchor, target), Math.max(anchor, target) + 1);
  }
}
