export type Gender = 'FEMALE' | 'MALE' | 'NOT_SPECIFIED';

export type ResearchCareerStage =
  | 'R1_FIRST_STAGE'
  | 'R2_RECOGNIZED'
  | 'R3_ESTABLISHED'
  | 'R4_LEADING';

export const GENDER_LABELS: Record<Gender, string> = {
  FEMALE: 'Femme',
  MALE: 'Homme',
  NOT_SPECIFIED: 'Non spécifié'
};

export const CAREER_STAGE_LABELS: Record<ResearchCareerStage, string> = {
  R1_FIRST_STAGE: 'R1 — Chercheur débutant (First Stage)',
  R2_RECOGNIZED: 'R2 — Chercheur reconnu (Recognised)',
  R3_ESTABLISHED: 'R3 — Chercheur établi (Established)',
  R4_LEADING: 'R4 — Chercheur leader (Leading)'
};

export const CAREER_STAGE_SHORT_LABELS: Record<ResearchCareerStage, string> = {
  R1_FIRST_STAGE: 'R1 Débutant',
  R2_RECOGNIZED: 'R2 Reconnu',
  R3_ESTABLISHED: 'R3 Établi',
  R4_LEADING: 'R4 Leader'
};

export interface Tag {
  id: string;
  name: string;
  color?: string | null;
  description?: string;
  _count?: { contacts: number };
}

export interface Segment {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  filters: FilterState;
  /** Nombre exact de contacts correspondant, calculé côté serveur (GET /api/segments). */
  memberCount?: number;
}

// Recherche de contacts sauvegardée par l'utilisateur (privée, par utilisateur)
export interface SavedSearch {
  id: string;
  name: string;
  filters: FilterState;
  userId: string;
  createdAt: string;
}

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  name?: string;
  initials?: string;
  email: string;
  gender: Gender;
  countryOfOrigin: string;
  city?: string | null;
  phone?: string | null;
  affiliation: string;
  function?: string | null;
  experience?: string | null;
  facultyDepartment?: string | null;
  researchCareerStage: ResearchCareerStage;
  avatarUrl?: string | null;
  tags: string[];
}

export type Privilege = 'READ' | 'READ_WRITE' | 'FULL_ACCESS';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  privilege?: Privilege;
  avatarUrl?: string | null;
  isFirstLogin?: boolean;
}

export interface FilterState {
  search: string;
  countries: string[];
  genders: Gender[];
  careerStages: ResearchCareerStage[];
  tags: string[];
}

export type ContactSortBy =
  | 'name'
  | 'countryOfOrigin'
  | 'affiliation'
  | 'researchCareerStage'
  | 'gender'
  | 'tags'
  | 'createdAt';

export type ContactSortOrder = 'asc' | 'desc';

export interface ContactSortQuery {
  sortBy?: ContactSortBy;
  sortOrder?: ContactSortOrder;
}

export type SelectionMode = 'none' | 'page' | 'partial' | 'all-filtered';

export interface ContactSelection {
  mode: SelectionMode;
  ids: string[];
  filters: FilterState;
  totalCount: number;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  currentPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  totalRecords: number;
}
