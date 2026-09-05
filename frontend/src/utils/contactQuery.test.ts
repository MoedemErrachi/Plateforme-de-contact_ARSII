import { describe, expect, it } from 'vitest';
import type { FilterState, Tag } from '../types';
import {
  filterStateToSearchParams,
  buildContactsListQuery,
  buildContactsExportQuery,
  isEmptyFilterState,
  emptyFilterState,
} from './contactQuery';

function empty(): FilterState {
  return { search: '', countries: [], genders: [], careerStages: [], tags: [] };
}

const tags: Tag[] = [
  { id: 't1', name: 'IA' },
  { id: 't2', name: 'Biologie' },
];

describe('filterStateToSearchParams', () => {
  it('sets search when trimmed and non-empty', () => {
    const p = filterStateToSearchParams({ ...empty(), search: '  alice  ' }, tags);
    expect(p.get('search')).toBe('alice');
  });

  it('omits search when empty', () => {
    const p = filterStateToSearchParams(empty(), tags);
    expect(p.get('search')).toBeNull();
  });

  it('appends multi-valued filters as repeated params', () => {
    const p = filterStateToSearchParams(
      { ...empty(), countries: ['Tunisie', 'France'], genders: ['MALE', 'FEMALE'], careerStages: ['R1_FIRST_STAGE'] },
      tags
    );
    expect(p.getAll('countryOfOrigin')).toEqual(['Tunisie', 'France']);
    expect(p.getAll('gender')).toEqual(['MALE', 'FEMALE']);
    expect(p.getAll('researchCareerStage')).toEqual(['R1_FIRST_STAGE']);
  });

  it('resolves tag names to tagId (case-insensitive) and ignores unknown tags', () => {
    const p = filterStateToSearchParams({ ...empty(), tags: ['IA', 'INCONNU'] }, tags);
    expect(p.getAll('tagId')).toEqual(['t1']);
  });
});

describe('buildContactsListQuery', () => {
  it('builds a path with page and limit', () => {
    const q = buildContactsListQuery(empty(), tags, 2, 20);
    expect(q).toContain('/api/contacts');
    expect(q).toContain('page=2');
    expect(q).toContain('limit=20');
  });

  it('always includes page and limit', () => {
    expect(buildContactsListQuery(empty(), tags, 1, 20)).toBe('/api/contacts?page=1&limit=20');
  });

  it('appends sortBy and sortOrder when provided', () => {
    expect(buildContactsListQuery(empty(), tags, 1, 10, { sortBy: 'name', sortOrder: 'asc' })).toBe(
      '/api/contacts?page=1&limit=10&sortBy=name&sortOrder=asc'
    );
  });
});

describe('buildContactsExportQuery', () => {
  it('adds ids, format and fields', () => {
    const q = buildContactsExportQuery(empty(), tags, ['a', 'b'], { format: 'csv', fields: ['email'], includeTags: true });
    expect(q).toContain('/api/contacts/export');
    expect(q).toContain('ids=a');
    expect(q).toContain('ids=b');
    expect(q).toContain('format=csv');
    expect(q).toContain('fields=email');
    expect(q).toContain('includeTags=1');
  });

  it('omits ids when none provided and includeTags as 0 when false', () => {
    const q = buildContactsExportQuery(empty(), tags, [], { includeTags: false });
    expect(q).not.toContain('ids=');
    expect(q).toContain('includeTags=0');
  });

  it('returns path only when nothing extra', () => {
    expect(buildContactsExportQuery(empty(), tags)).toBe('/api/contacts/export');
  });
});

describe('isEmptyFilterState', () => {
  it('returns true for an empty filter set', () => {
    expect(isEmptyFilterState(empty())).toBe(true);
  });

  it('returns false when any filter is present', () => {
    expect(isEmptyFilterState({ ...empty(), countries: ['Tunisie'] })).toBe(false);
    expect(isEmptyFilterState({ ...empty(), tags: ['IA'] })).toBe(false);
    expect(isEmptyFilterState({ ...empty(), search: 'x' })).toBe(false);
  });
});

describe('emptyFilterState', () => {
  it('returns a fresh empty filter set', () => {
    expect(emptyFilterState()).toEqual(empty());
  });
});
