import { describe, expect, it } from 'vitest';
import { filterBySearch } from './search';

type Item = { name: string; email: string | null; count: number };

const ALICE: Item = { name: 'Alice Smith', email: 'alice@example.com', count: 1 };
const BOB: Item = { name: 'Bob Jones', email: null, count: 2 };
const ITEMS = [ALICE, BOB];

describe(filterBySearch.name, () => {
  it('keeps every item for an empty term', () => {
    expect(filterBySearch(ITEMS, '', ['name'])).toEqual(ITEMS);
  });

  it('matches any key ignoring case', () => {
    expect(filterBySearch(ITEMS, 'JONES', ['name', 'email'])).toEqual([BOB]);
    expect(filterBySearch(ITEMS, 'example', ['name', 'email'])).toEqual([ALICE]);
  });

  it('only searches the given keys', () => {
    expect(filterBySearch(ITEMS, 'example', ['name'])).toEqual([]);
  });

  it('skips empty values', () => {
    expect(filterBySearch(ITEMS, 'null', ['email'])).toEqual([]);
  });
});
