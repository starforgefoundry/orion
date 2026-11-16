import * as v from 'valibot';

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

/** Fields for a paged list request, defaulting to the first page. */
export function pageFields(pageSize = DEFAULT_PAGE_SIZE) {
  return {
    page: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), 1),
    pageSize: v.optional(
      v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(MAX_PAGE_SIZE)),
      pageSize,
    ),
  };
}
