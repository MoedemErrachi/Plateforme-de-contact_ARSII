function serializeValue(value: unknown): string {
  if (value == null) return '';
  return JSON.stringify(value);
}

/**
 * Escape and quote a value for CSV output.
 * Handles null/undefined and escapes double quotes.
 */
export function csvCell(value: unknown): string {
  const text = typeof value === 'string' ? value : serializeValue(value);
  return `"${text.replaceAll('"', '""')}"`;
}