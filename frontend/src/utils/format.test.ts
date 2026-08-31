import { describe, expect, it } from 'vitest';
import { formatFullName, splitFullName } from './format';

describe('formatFullName', () => {
  it('combines first and last name', () => {
    expect(formatFullName('Jean', 'Dupont')).toBe('Jean Dupont');
  });

  it('handles only a first name', () => {
    expect(formatFullName('Jean')).toBe('Jean');
  });

  it('handles only a last name', () => {
    expect(formatFullName(undefined, 'Dupont')).toBe('Dupont');
  });

  it('trims surrounding whitespace', () => {
    expect(formatFullName(' Jean ', ' Dupont ')).toBe('Jean Dupont');
  });

  it('treats N/A as empty', () => {
    expect(formatFullName('N/A', 'N/A')).toBe('N/A');
    expect(formatFullName('N/A', 'Dupont')).toBe('Dupont');
  });

  it('returns N/A when both are empty', () => {
    expect(formatFullName(null, undefined)).toBe('N/A');
    expect(formatFullName('', '')).toBe('N/A');
  });
});

describe('splitFullName', () => {
  it('returns empty for undefined/null/empty', () => {
    expect(splitFullName(undefined)).toEqual({ firstName: '', lastName: '' });
    expect(splitFullName('')).toEqual({ firstName: '', lastName: '' });
  });

  it('handles a single word', () => {
    expect(splitFullName('Jean')).toEqual({ firstName: 'Jean', lastName: '' });
  });

  it('handles multiple words', () => {
    expect(splitFullName('Jean Pierre Dupont')).toEqual({ firstName: 'Jean', lastName: 'Pierre Dupont' });
  });

  it('trims and collapses whitespace', () => {
    expect(splitFullName('  Jean   Dupont  ')).toEqual({ firstName: 'Jean', lastName: 'Dupont' });
  });
});
