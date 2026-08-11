export type ViewPage =
  | 'dashboard'
  | 'contacts'
  | 'contact-detail'
  | 'importation'
  | 'new-contact'
  | 'exportation'
  | 'auth'
  | 'segmentation';

export type Gender = 'FEMALE' | 'MALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';

export type ResearchCareerStage =
  | 'R1_FIRST_STAGE'
  | 'R2_RECOGNIZED'
  | 'R3_ESTABLISHED'
  | 'R4_LEADING';

export const GENDER_LABELS: Record<Gender, string> = {
  FEMALE: 'Femme',
  MALE: 'Homme',
  OTHER: 'Autre',
  PREFER_NOT_TO_SAY: 'Préfère ne pas dire'
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

export interface ExchangeNote {
  id: string;
  date: string;
  relativeTime?: string;
  title: string;
  content: string;
  author?: string;
  authorInitials?: string;
  projectName?: string;
  type: 'meeting' | 'email' | 'call' | 'note';
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  category?: string;
  description?: string;
  _count?: { contacts: number };
}

export interface Segment {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  filters: FilterState;
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
  city: string;
  phone: string;
  affiliation: string;
  function?: string;
  experience?: string;
  facultyDepartment?: string;
  researchCareerStage: ResearchCareerStage;
  avatarUrl?: string;
  isVerified?: boolean;
  tags: string[];
  exchangeNotes: ExchangeNote[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string | null;
}

export interface FilterState {
  search: string;
  countries: string[];
  genders: Gender[];
  careerStages: ResearchCareerStage[];
  affiliations: string;
  tags: string[];
}
