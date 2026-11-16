export type EnumValue<T> = T[keyof T];

export function enumValues<T extends Record<string, string>>(values: T) {
  return Object.values(values) as [EnumValue<T>, ...EnumValue<T>[]];
}
