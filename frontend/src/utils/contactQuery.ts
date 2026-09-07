import { FilterState, Tag, ContactSortQuery } from '../types';

export type ExportFormat = 'csv' | 'xlsx' | 'json';

export interface ExportExtraParams {
  format?: ExportFormat;
  fields?: string[];
  includeTags?: boolean;
}

const EMPTY_FILTERS: FilterState = {
  search: '',
  countries: [],
  genders: [],
  careerStages: [],
  tags: []
};

/**
 * Traduit les filtres frontend en paramètres de requête backend.
 * Multi-sélection → params répétés (arrays) ; les tags (noms) sont résolus
 * en tagId ; le stade est envoyé via researchCareerStage (alias serveur).
 */
export function filterStateToSearchParams(filters: FilterState, tags: Tag[]): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.search.trim()) params.set('search', filters.search.trim());
  filters.countries.forEach(c => params.append('countryOfOrigin', c));
  filters.genders.forEach(g => params.append('gender', g));
  filters.careerStages.forEach(s => params.append('researchCareerStage', s));
  filters.tags.forEach(t => {
    const tag = tags.find(x => x.name.toLowerCase() === t.toLowerCase());
    if (tag) params.append('tagId', tag.id);
  });
  return params;
}

export function buildContactsListQuery(
  filters: FilterState,
  tags: Tag[],
  page: number,
  limit: number,
  sort?: ContactSortQuery
): string {
  const params = filterStateToSearchParams(filters, tags);
  params.set('page', String(page));
  params.set('limit', String(limit));
  if (sort?.sortBy) params.set('sortBy', sort.sortBy);
  if (sort?.sortOrder) params.set('sortOrder', sort.sortOrder);
  const qs = params.toString();
  return qs ? `/api/contacts?${qs}` : '/api/contacts';
}

export function buildContactsExportQuery(
  filters: FilterState,
  tags: Tag[],
  ids?: string[],
  extra?: ExportExtraParams
): string {
  const params = filterStateToSearchParams(filters, tags);
  if (ids?.length) {
    ids.forEach(id => params.append('ids', id));
  }
  if (extra?.format) params.set('format', extra.format);
  if (extra?.fields?.length) {
    extra.fields.forEach(field => params.append('fields', field));
  }
  if (extra?.includeTags !== undefined) {
    params.set('includeTags', extra.includeTags ? '1' : '0');
  }
  const qs = params.toString();
  return qs ? `/api/contacts/export?${qs}` : '/api/contacts/export';
}

export function isEmptyFilterState(filters: FilterState): boolean {
  return (
    !filters.search.trim() &&
    filters.countries.length === 0 &&
    filters.genders.length === 0 &&
    filters.careerStages.length === 0 &&
    filters.tags.length === 0
  );
}

export function emptyFilterState(): FilterState {
  return { ...EMPTY_FILTERS };
}
