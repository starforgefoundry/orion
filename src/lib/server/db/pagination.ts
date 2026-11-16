import type { PgSelect } from 'drizzle-orm/pg-core';

export type PageRequest = { page: number; pageSize: number };

/** Runs one page of `rows` alongside `counted`, which counts every matching row. */
export async function paginate<Rows extends PgSelect>(
  rows: Rows,
  counted: PromiseLike<{ total: number }[]>,
  { page, pageSize }: PageRequest,
) {
  const [[{ total }], data] = await Promise.all([
    counted,
    rows.limit(pageSize).offset((page - 1) * pageSize) as unknown as Promise<Awaited<Rows>>,
  ]);
  return { data, pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } };
}
