export type ViewPage = 
  | 'dashboard' 
  | 'contacts' 
  | 'contact-detail' 
  | 'importation' 
  | 'new-contact' 
  | 'exportation' 
  | 'auth' 
  | 'segmentation';

export type ActorType = 'Labo de recherche' | 'PME' | 'ONG' | 'Université' | 'Institutionnel';

export interface Project {
  id: string;
  title: string;
  description: string;
  period: string;
  status: 'En cours' | 'Planifié' | 'Terminé';
  sector: string;
  imageUrl?: string;
}

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
  name: string;
  initials: string;
  title: string;
  organization: string;
  email: string;
  phone: string;
  linkedin?: string;
  country: string;
  flagEmoji?: string;
  interventionZones: string[];
  actorType: ActorType;
  expertise: string[];
  tags?: string[];
  avatarUrl?: string;
  projects: Project[];
  exchangeNotes: ExchangeNote[];
  isVerified?: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string | null;
}

export interface ImportConflict {
  id: string;
  imported: {
    name: string;
    org: string;
    email: string;
    type: string;
  };
  existing: {
    name: string;
    org: string;
    email: string;
  };
  status: 'conflict' | 'resolved_merged' | 'ignored' | 'forced_new';
}

export interface FilterState {
  search: string;
  headquarters: string;
  zones: string[];
  expertises: string[];
  actorTypes: string[];
  tags: string[];
}
