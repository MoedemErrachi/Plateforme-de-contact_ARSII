/**
 * Central display formatter for contact fields.
 * Returns the trimmed value when present, or the em-dash placeholder otherwise.
 */
export function formatFieldValue(value: string | null | undefined): string {
  return value?.trim() || '\u2014';
}
