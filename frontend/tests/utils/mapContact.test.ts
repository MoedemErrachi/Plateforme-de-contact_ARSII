import { describe, expect, it } from 'vitest';
import { mapContactFromApi } from '../../src/utils/mapContact';

describe('mapContactFromApi', () => {
  it('builds name and initials from first/last name', () => {
    const result = mapContactFromApi({ firstName: 'Jean', lastName: 'Dupont' });
    expect(result.name).toBe('Jean Dupont');
    expect(result.initials).toBe('JD');
  });

  it('falls back to initial when only one name is present', () => {
    const result = mapContactFromApi({ firstName: 'Jean', lastName: '' });
    expect(result.initials).toBe('J');
  });

  it('uses NC when no names are available and no initials given', () => {
    const result = mapContactFromApi({ firstName: 'N/A', lastName: 'N/A' });
    expect(result.initials).toBe('NC');
  });

  it('keeps provided initials over computed ones when no names', () => {
    const result = mapContactFromApi({ initials: 'ZZ' });
    expect(result.initials).toBe('ZZ');
  });

  it('normalizes gender to NOT_SPECIFIED for unknown values', () => {
    expect(mapContactFromApi({ gender: 'MALE' }).gender).toBe('MALE');
    expect(mapContactFromApi({ gender: 'FEMALE' }).gender).toBe('FEMALE');
    expect(mapContactFromApi({ gender: 'OTHER' }).gender).toBe('NOT_SPECIFIED');
    expect(mapContactFromApi({}).gender).toBe('NOT_SPECIFIED');
  });

  it('defaults researchCareerStage and countryOfOrigin', () => {
    const result = mapContactFromApi({});
    expect(result.researchCareerStage).toBe('R1_FIRST_STAGE');
    expect(result.countryOfOrigin).toBe('');
    expect(result.affiliation).toBe('');
  });

  it('maps tags from objects and strings', () => {
    const result = mapContactFromApi({
      tags: [{ tag: { name: 'IA' } }, { name: 'Bio' }, 'Simple'],
    });
    expect(result.tags).toEqual(['IA', 'Bio', 'Simple']);
  });

  it('returns an empty tags array for non-array input', () => {
    expect(mapContactFromApi({ tags: 'not-an-array' }).tags).toEqual([]);
    expect(mapContactFromApi({}).tags).toEqual([]);
  });

  it('keeps city and phone nullability', () => {
    expect(mapContactFromApi({}).city).toBeNull();
    expect(mapContactFromApi({}).phone).toBeNull();
    expect(mapContactFromApi({ city: 'Paris', phone: '123' }).city).toBe('Paris');
  });
});
