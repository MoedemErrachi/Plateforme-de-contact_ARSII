/**
 * Escape and quote a value for CSV output.
 * Handles null/undefined and escapes double quotes.
 */
export function csvCell(value: unknown): string {
  const text = typeof value === 'string' ? value : value == null ? '' : JSON.stringify(value);
  return `"${text.replaceAll('"', '""')}"`;
}