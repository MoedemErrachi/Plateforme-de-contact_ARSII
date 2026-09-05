/**
 * Convert a value (string | string[] | undefined) to a string array.
 * Used for normalizing query parameters that may be single values or arrays.
 */
export function toArray(value: unknown): string[] | undefined {
  if (value == null) return undefined;
  if (Array.isArray(value)) return value;
  return [typeof value === 'string' ? value : JSON.stringify(value)];
}