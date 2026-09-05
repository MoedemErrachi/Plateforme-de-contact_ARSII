import { describe, expect, it, vi, beforeAll } from 'vitest';

// ContactService imports prisma at module load (config/prisma instantiates a
// PrismaClient). Mock it so loading the module and its pure functions works
// without a real database connection.
vi.mock('../config/prisma', () => ({
  prisma: {},
}));

import {
  normalizeCountry,
  iso2ForCountry,
  EXPORT_FIELD_KEYS,
  EXPORT_FIELD_HEADERS,
  EXPORT_TAGS_HEADER,
} from './contactService';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret';
});

describe('normalizeCountry', () => {
  it('returns empty string for null/undefined/empty input', () => {
    expect(normalizeCountry(null)).toBe('');
    expect(normalizeCountry(undefined)).toBe('');
    expect(normalizeCountry('')).toBe('');
    expect(normalizeCountry('   ')).toBe('');
  });

  it('returns empty string for "not provided" labels', () => {
    expect(normalizeCountry('N/A')).toBe('');
    expect(normalizeCountry('inconnu')).toBe('');
    expect(normalizeCountry('non renseigné')).toBe('');
    expect(normalizeCountry('aucun')).toBe('');
  });

  it('maps an ISO alpha-2 code to the canonical French label', () => {
    expect(normalizeCountry('FR')).toBe('France');
    expect(normalizeCountry('TN')).toBe('Tunisie');
    expect(normalizeCountry('us')).toBe('États-Unis');
    expect(normalizeCountry('CI')).toBe('Côte d\u2019Ivoire');
  });

  it('normalizes a canonical French label (case + accents via alias)', () => {
    expect(normalizeCountry('france')).toBe('France');
    expect(normalizeCountry('FRANCE')).toBe('France');
  });

  it('normalizes an accent-insensitive match', () => {
    expect(normalizeCountry('Algerie')).toBe('Algérie');
  });

  it('capitalizes an unknown but non-empty value', () => {
    expect(normalizeCountry('atlantide')).toBe('Atlantide');
    expect(normalizeCountry('   xyzzzz   ')).toBe('Xyzzzz');
  });

  it('handles corrupted placeholder characters for a 1-char country name', () => {
    // 'Fr\uFFFDnce' has one placeholder -> expands to try a-z -> France
    expect(normalizeCountry('Fr\uFFFDnce')).toBe('France');
  });

  it('falls back to the stripped, capitalized value when placeholders cannot resolve', () => {
    // Unknown string with placeholders beyond resolution collapses to cleaned text.
    const result = normalizeCountry('\uFFFD\uFFFD\uFFFDzz');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('iso2ForCountry', () => {
  it('returns null for empty/invalid input', () => {
    expect(iso2ForCountry(null)).toBeNull();
    expect(iso2ForCountry('')).toBeNull();
  });

  it('returns null for an unknown name', () => {
    expect(iso2ForCountry('atlantide')).toBeNull();
  });

  it('maps a French label to its ISO alpha-2 code', () => {
    expect(iso2ForCountry('France')).toBe('FR');
    expect(iso2ForCountry('Tunisie')).toBe('TN');
  });

  it('maps an ISO alpha-2 code to itself (uppercased)', () => {
    expect(iso2ForCountry('fr')).toBe('FR');
    expect(iso2ForCountry('TN')).toBe('TN');
  });

  it('maps via alias (accent-insensitive)', () => {
    expect(iso2ForCountry('Algerie')).toBe('DZ');
  });
});

describe('export schema constants', () => {
  it('defines EXPORT_TAGS_HEADER as a non-empty string', () => {
    expect(typeof EXPORT_TAGS_HEADER).toBe('string');
    expect(EXPORT_TAGS_HEADER.length).toBeGreaterThan(0);
  });

  it('has a header for every field key', () => {
    for (const key of EXPORT_FIELD_KEYS) {
      expect(EXPORT_FIELD_HEADERS[key]).toBeTruthy();
    }
  });

  it('has unique field keys', () => {
    const unique = new Set(EXPORT_FIELD_KEYS);
    expect(unique.size).toBe(EXPORT_FIELD_KEYS.length);
  });
});
