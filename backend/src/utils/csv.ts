/**
 * Escape and quote a value for CSV output.
 * Handles null/undefined and escapes double quotes.
 */
export function csvCell(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}