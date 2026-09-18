import { describe, it, expect } from 'vitest';
import { COUNTRIES, Country } from '../../src/constants/countries';

describe('COUNTRIES', () => {
  it('is a non-empty array of Country objects', () => {
    expect(Array.isArray(COUNTRIES)).toBe(true);
    expect(COUNTRIES.length).toBeGreaterThanOrEqual(190);
    for (const c of COUNTRIES) {
      expect(c).toHaveProperty('code');
      expect(c).toHaveProperty('label');
      expect(typeof c.code).toBe('string');
      expect(typeof c.label).toBe('string');
      expect(c.label.trim().length).toBeGreaterThan(0);
    }
  });

  it('contains unique country codes', () => {
    const codes = COUNTRIES.map(c => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('contains unique labels', () => {
    const labels = COUNTRIES.map(c => c.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('includes France (FR)', () => {
    expect(COUNTRIES.find(c => c.code === 'FR')).toEqual({ code: 'FR', label: 'France' });
  });

  it('includes Maroc (MA)', () => {
    expect(COUNTRIES.find(c => c.code === 'MA')).toEqual({ code: 'MA', label: 'Maroc' });
  });

  it('includes Tunisie (TN)', () => {
    expect(COUNTRIES.find(c => c.code === 'TN')).toEqual({ code: 'TN', label: 'Tunisie' });
  });

  it('includes all four Maghreb countries in the list', () => {
    const maghreb = ['MA', 'TN', 'DZ', 'LY'];
    for (const code of maghreb) {
      expect(COUNTRIES.find(c => c.code === code)).toBeDefined();
    }
  });

  it('includes all major global powers', () => {
    const major = ['US', 'CN', 'JP', 'GB', 'DE', 'IN', 'BR'];
    for (const code of major) {
      expect(COUNTRIES.find(c => c.code === code)).toBeDefined();
    }
  });
});