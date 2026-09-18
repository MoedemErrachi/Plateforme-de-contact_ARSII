import { describe, expect, it } from 'vitest';
import { formatFieldValue } from '../../src/utils/formatFieldValue';

describe('formatFieldValue', () => {
  it('returns the trimmed value when present', () => {
    expect(formatFieldValue('  Paris  ')).toBe('Paris');
  });

  it('returns em-dash for undefined', () => {
    expect(formatFieldValue(undefined)).toBe('\u2014');
  });

  it('returns em-dash for null', () => {
    expect(formatFieldValue(null)).toBe('\u2014');
  });

  it('returns em-dash for empty string', () => {
    expect(formatFieldValue('')).toBe('\u2014');
  });

  it('returns em-dash for whitespace-only string', () => {
    expect(formatFieldValue('   ')).toBe('\u2014');
  });
});
