/**
 * Convert a value (string | string[] | undefined) to a string array.
 * Used for normalizing query parameters that may be single values or arrays.
 */
export function toArray(value: unknown): string[] | undefined {
  if (value == null) return undefined;
  return Array.isArray(value) ? value : [String(value)];
}