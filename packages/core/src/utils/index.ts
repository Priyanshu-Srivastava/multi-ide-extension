export function assertNonNullable<T>(
  value: T,
  label: string
): asserts value is NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error(`Expected '${label}' to be defined but received ${value}.`);
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function deepMerge<T extends Record<string, unknown>>(
  base: T,
  override: Partial<T>
): T {
  const result = { ...base };
  for (const key of Object.keys(override) as (keyof T)[]) {
    const a = base[key];
    const b = override[key];
    if (isRecord(a) && isRecord(b)) {
      (result as Record<string, unknown>)[key as string] = deepMerge(
        a as Record<string, unknown>,
        b as Record<string, unknown>
      );
    } else if (b !== undefined) {
      result[key] = b as T[keyof T];
    }
  }
  return result;
}
