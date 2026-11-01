type TextKey<T> = { [K in keyof T]: T[K] extends string | null | undefined ? K : never }[keyof T];

/** Keeps the items where any of `keys` contains `term`, ignoring case. */
export function filterBySearch<T>(items: T[], term: string, keys: TextKey<T>[]) {
  const needle = term.toLowerCase();
  if (!needle) return items;

  return items.filter((item) =>
    keys.some((key) =>
      ((item[key] as string | null | undefined) ?? '').toLowerCase().includes(needle),
    ),
  );
}
