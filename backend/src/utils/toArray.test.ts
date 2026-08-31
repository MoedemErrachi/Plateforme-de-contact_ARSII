import { describe, expect, it } from 'vitest';
import { toArray } from './toArray';

describe('toArray', () => {
  it('returns undefined for null', () => {
    expect(toArray(null)).toBeUndefined();
  });

  it('returns undefined for undefined', () => {
    expect(toArray(undefined)).toBeUndefined();
  });

  it('returns the same array for an array input', () => {
    const arr = ['a', 'b'];
    expect(toArray(arr)).toBe(arr);
  });

  it('wraps a single string in an array', () => {
    expect(toArray('alice')).toEqual(['alice']);
  });

  it('converts a non-array, non-string value to a string array', () => {
    expect(toArray(42)).toEqual(['42']);
  });
});
