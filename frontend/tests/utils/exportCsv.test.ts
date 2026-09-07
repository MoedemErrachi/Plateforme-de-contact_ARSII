import { describe, it, expect } from 'vitest';
import { FIELD_LABELS, FIELD_HEADERS, FieldKey } from '../../src/utils/exportCsv';

const ALL_KEYS: FieldKey[] = [
  'email', 'firstName', 'lastName', 'gender', 'countryOfOrigin', 'city',
  'phone', 'affiliation', 'function', 'experience', 'facultyDepartment',
  'researchCareerStage'
];

describe('FIELD_LABELS', () => {
  it('has exactly 12 entries (one for each field)', () => {
    expect(FIELD_LABELS).toHaveLength(12);
  });

  it('every entry has a non-empty label and a valid key', () => {
    for (const entry of FIELD_LABELS) {
      expect(entry.label.trim().length).toBeGreaterThan(0);
      expect(ALL_KEYS).toContain(entry.key);
    }
  });

  it('covers every canonical key exactly once', () => {
    const keys = FIELD_LABELS.map(e => e.key);
    expect(new Set(keys).size).toBe(12);
    expect(keys).toEqual(expect.arrayContaining(ALL_KEYS));
  });
});

describe('FIELD_HEADERS', () => {
  it('has an entry for every field', () => {
    expect(Object.keys(FIELD_HEADERS)).toHaveLength(12);
    for (const key of ALL_KEYS) {
      expect(FIELD_HEADERS[key]).toBeTruthy();
    }
  });

  it('every header value is a non-empty French label', () => {
    for (const [key, header] of Object.entries(FIELD_HEADERS)) {
      expect(header.trim().length).toBeGreaterThan(0);
      expect(typeof key).toBe('string');
    }
  });
});