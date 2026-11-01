import { describe, expect, it } from 'vitest';
import { TableSelection } from './table-selection.svelte';

type Row = { id: string };

const ROWS: Row[] = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id }));

function selection(rows: Row[] = ROWS) {
  return new TableSelection(
    () => rows,
    (row) => row.id,
  );
}

function row(id: string) {
  return ROWS.find((candidate) => candidate.id === id)!;
}

describe(TableSelection.name, () => {
  it('toggles single rows', () => {
    const table = selection();

    table.toggle(row('b'), true);
    expect(table.has(row('b'))).toBe(true);
    expect(table.size).toBe(1);

    table.toggle(row('b'), false);
    expect(table.size).toBe(0);
  });

  it('selects the range between the last toggled row and a shift-clicked row', () => {
    const table = selection();

    table.toggle(row('b'), true);
    table.toggle(row('d'), true, true);

    expect(table.selectedIds).toEqual(['b', 'c', 'd']);
  });

  it('moves the range anchor to each toggled row', () => {
    const table = selection();

    table.toggle(row('a'), true);
    table.toggle(row('c'), true, true);
    table.toggle(row('e'), false, true);

    expect(table.selectedIds).toEqual(['a', 'b']);
  });

  it('selects only the clicked row when no anchor is visible', () => {
    const table = selection();

    table.toggle(row('c'), true, true);

    expect(table.selectedIds).toEqual(['c']);
  });

  it('reports all and some selected', () => {
    const table = selection();
    expect(table.allSelected).toBe(false);

    table.toggle(row('a'), true);
    expect(table.someSelected).toBe(true);

    table.toggleAll(true);
    expect(table.allSelected).toBe(true);
    expect(table.someSelected).toBe(false);
    expect(table.selectedRows).toEqual(ROWS);

    table.toggleAll(false);
    expect(table.size).toBe(0);
  });

  it('is never all selected without rows', () => {
    expect(selection([]).allSelected).toBe(false);
  });

  it('deselects given ids', () => {
    const table = selection();
    table.toggleAll(true);

    table.deselect(['a', 'b']);

    expect(table.selectedIds).toEqual(['c', 'd', 'e']);
  });
});
