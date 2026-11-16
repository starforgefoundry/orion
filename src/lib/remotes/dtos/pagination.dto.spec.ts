import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, pageFields } from './pagination.dto';

describe(pageFields.name, () => {
  const dto = v.object(pageFields());

  it('starts on the first page with the default size', () => {
    expect(v.parse(dto, {})).toEqual({ page: 1, pageSize: DEFAULT_PAGE_SIZE });
  });

  it('rejects pages past the size limit', () => {
    expect(v.safeParse(dto, { pageSize: MAX_PAGE_SIZE + 1 }).success).toBe(false);
  });

  it('rejects a page before the first', () => {
    expect(v.safeParse(dto, { page: 0 }).success).toBe(false);
  });
});
