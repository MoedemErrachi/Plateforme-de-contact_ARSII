import { PrismaClient } from '@prisma/client';

let prismaInstance: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient | null {
  if (!process.env.DATABASE_URL) {
    return null;
  }
  if (!prismaInstance) {
    try {
      prismaInstance = new PrismaClient();
    } catch (err) {
      console.warn('Could not initialize PrismaClient:', err);
      return null;
    }
  }
  return prismaInstance;
}

export interface ContactEntity {
  id: string;
  firstName: string;
  lastName: string;
  organization: string;
  country: string;
  email: string;
  phone: string;
  linkedinUrl?: string;
  expertiseDomain: string;
  typeActeurId: string;
}

export interface TypeActeurEntity {
  id: string;
  label: string;
  isPredefined: boolean;
}

export interface SegmentTagEntity {
  id: string;
  name: string;
  color: string;
}

export interface ProjectEntity {
  id: string;
  title: string;
  code: string;
}

export interface ExchangeNoteEntity {
  id: string;
  contactId: string;
  note: string;
  date: string;
}

export interface ImportExportLogEntity {
  id: string;
  type: 'IMPORT' | 'EXPORT';
  format: 'CSV' | 'XLSX' | 'JSON';
  fileName: string;
  recordCount: number;
  status: string;
  performedBy: string;
  createdAt: string;
}

export class DataStore {
  private static instance: DataStore;

  public contacts: ContactEntity[] = [];
  public typeActeurs: TypeActeurEntity[] = [];
  public segments: SegmentTagEntity[] = [];
  public projects: ProjectEntity[] = [];
  public exchangeNotes: ExchangeNoteEntity[] = [];
  public importExportLogs: ImportExportLogEntity[] = [];

  private constructor() {
    this.seedData();
  }

  public static getInstance(): DataStore {
    if (!DataStore.instance) {
      DataStore.instance = new DataStore();
    }
    return DataStore.instance;
  }

  // --- PRISMA ORM INTEGRATION METHODS ---

  public async getContactsFromPrisma() {
    const client = getPrismaClient();
    if (client) {
      try {
        return await client.contact.findMany({
          include: {
            typeActeur: true,
            tags: { include: { tag: true } },
            projects: { include: { project: true } },
            exchangeNotes: true,
          }
        });
      } catch (err) {
        console.warn('Prisma DB query fallback to DataStore:', err);
      }
    }
    return this.contacts;
  }

  public async getContactByIdFromPrisma(id: string) {
    const client = getPrismaClient();
    if (client) {
      try {
        return await client.contact.findUnique({
          where: { id },
          include: {
            typeActeur: true,
            tags: { include: { tag: true } },
            projects: { include: { project: true } },
            exchangeNotes: true,
          }
        });
      } catch (err) {
        console.warn('Prisma getContactById fallback:', err);
      }
    }
    return this.contacts.find(c => c.id === id);
  }

  public async createContactInPrisma(data: any) {
    const client = getPrismaClient();
    if (client) {
      try {
        return await client.contact.create({
          data: {
            name: `${data.firstName || ''} ${data.lastName || ''}`.trim() || data.name || 'Nouveau Contact',
            initials: `${data.firstName?.[0] || ''}${data.lastName?.[0] || ''}`.toUpperCase() || 'NC',
            title: data.title || 'Membre Réseau',
            organization: data.organization || '',
            email: data.email || '',
            phone: data.phone || '',
            linkedin: data.linkedinUrl || data.linkedin || '',
            country: data.country || 'Tunisie',
            actorType: data.actorType || 'PME',
            expertise: data.expertiseDomain ? [data.expertiseDomain] : data.expertise || [],
            interventionZones: data.country ? [data.country] : [],
          }
        });
      } catch (err) {
        console.warn('Prisma DB creation fallback:', err);
      }
    }

    const newContact: ContactEntity = {
      id: `contact-${Date.now()}`,
      firstName: data.firstName || 'Nom',
      lastName: data.lastName || 'Prénom',
      email: data.email || '',
      organization: data.organization || '',
      country: data.country || 'Tunisie',
      phone: data.phone || '',
      linkedinUrl: data.linkedinUrl || '',
      expertiseDomain: data.expertiseDomain || '',
      typeActeurId: data.typeActeurId || 'type-pme'
    };
    this.contacts.push(newContact);
    return newContact;
  }

  public async getTagsFromPrisma() {
    const client = getPrismaClient();
    if (client) {
      try {
        return await client.tag.findMany();
      } catch (err) {
        console.warn('Prisma getTags fallback:', err);
      }
    }
    return this.segments;
  }

  public async getProjectsFromPrisma() {
    const client = getPrismaClient();
    if (client) {
      try {
        return await client.project.findMany();
      } catch (err) {
        console.warn('Prisma getProjects fallback:', err);
      }
    }
    return this.projects;
  }

  public async getImportExportLogsFromPrisma() {
    const client = getPrismaClient();
    if (client) {
      try {
        return await client.importExportLog.findMany({
          orderBy: { createdAt: 'desc' }
        });
      } catch (err) {
        console.warn('Prisma getImportExportLogs fallback:', err);
      }
    }
    return this.importExportLogs;
  }

  public async createImportExportLogInPrisma(data: {
    type: 'IMPORT' | 'EXPORT';
    format: 'CSV' | 'XLSX' | 'JSON';
    fileName: string;
    recordCount: number;
    performedBy?: string;
  }) {
    const client = getPrismaClient();
    if (client) {
      try {
        return await client.importExportLog.create({
          data: {
            type: data.type,
            format: data.format,
            fileName: data.fileName,
            recordCount: data.recordCount,
            performedBy: data.performedBy || 'Utilisateur Système',
            status: 'SUCCESS'
          }
        });
      } catch (err) {
        console.warn('Prisma createImportExportLog fallback:', err);
      }
    }

    const log: ImportExportLogEntity = {
      id: `log-${Date.now()}`,
      type: data.type,
      format: data.format,
      fileName: data.fileName,
      recordCount: data.recordCount,
      status: 'SUCCESS',
      performedBy: data.performedBy || 'Utilisateur Système',
      createdAt: new Date().toISOString()
    };
    this.importExportLogs.unshift(log);
    return log;
  }

  private seedData() {
    this.typeActeurs = [
      { id: 'type-lab', label: 'Labo de recherche', isPredefined: true },
      { id: 'type-pme', label: 'PME / Startup', isPredefined: true },
      { id: 'type-univ', label: 'Université / École', isPredefined: true },
      { id: 'type-assoc', label: 'Réseau / Association', isPredefined: true },
      { id: 'type-inst', label: 'Institution Publique', isPredefined: true }
    ];

    this.segments = [
      { id: 'seg-eu', name: 'Union Européenne', color: '#006a66' },
      { id: 'seg-green', name: 'Transition Verte', color: '#35b8b2' },
      { id: 'seg-health', name: 'Santé Globale', color: '#e06d53' },
      { id: 'seg-ai', name: 'IA & Digital', color: '#8a4baf' }
    ];

    this.projects = [
      { id: 'proj-1', title: 'Euro-African Tech Exchange (EATE)', code: 'EATE-2026' },
      { id: 'proj-2', title: 'Green Horizons Horizon Europe', code: 'GH-HE-04' },
      { id: 'proj-3', title: 'Digital Health Sahel', code: 'DHS-SAF-12' }
    ];

    this.contacts = [
      {
        id: 'contact-1',
        firstName: 'Amadou',
        lastName: 'Diallo',
        email: 'a.diallo@research-network.org',
        organization: 'Center for Energy Research',
        country: 'Sénégal',
        phone: '+221 33 800 00 00',
        linkedinUrl: 'https://linkedin.com/in/amadou-diallo-ri',
        expertiseDomain: 'Transition Énergétique & Hydrogène Vert',
        typeActeurId: 'type-lab'
      },
      {
        id: 'contact-2',
        firstName: 'Eva',
        lastName: 'Schneider',
        email: 'e.schneider@eu-agri.tech',
        organization: 'EU AgriTech Platform',
        country: 'Allemagne',
        phone: '+49 30 555 0123',
        linkedinUrl: 'https://linkedin.com/in/eva-schneider-agri',
        expertiseDomain: 'AgriTech & Sécurité Alimentaire',
        typeActeurId: 'type-assoc'
      },
      {
        id: 'contact-3',
        firstName: 'Fatou',
        lastName: 'Diallo',
        email: 'fatou.diallo@dakar-tech.sn',
        organization: 'Dakar Tech Incubator',
        country: 'Sénégal',
        phone: '+221 77 123 45 67',
        linkedinUrl: 'https://linkedin.com/in/fatou-diallo-tech',
        expertiseDomain: 'Intelligence Artificielle & Startups',
        typeActeurId: 'type-pme'
      },
      {
        id: 'contact-4',
        firstName: 'Stefan',
        lastName: 'Kovacs',
        email: 's.kovacs@budapest-bio.hu',
        organization: 'Budapest BioLab',
        country: 'Hongrie',
        phone: '+36 1 456 7890',
        linkedinUrl: 'https://linkedin.com/in/stefan-kovacs-bio',
        expertiseDomain: 'Biotechnologies & Genomique',
        typeActeurId: 'type-lab'
      },
      {
        id: 'contact-5',
        firstName: 'Sami',
        lastName: 'Ben Ali',
        email: 'sami.benali@tunis-innovation.tn',
        organization: 'Institut Pasteur de Tunis',
        country: 'Tunisie',
        phone: '+216 71 888 999',
        linkedinUrl: 'https://linkedin.com/in/sami-benali-health',
        expertiseDomain: 'Santé Globale & Immunologie',
        typeActeurId: 'type-lab'
      }
    ];

    this.exchangeNotes = [
      {
        id: 'note-1',
        contactId: 'contact-1',
        note: 'Meeting de cadrage pour le projet Horizon Europe EATE-2026. Accord verbal de partenariat.',
        date: '2026-07-20'
      },
      {
        id: 'note-2',
        contactId: 'contact-2',
        note: 'Invitation transmise pour la conférence R&I Europe-Afrique de Berlin.',
        date: '2026-07-25'
      }
    ];

    this.importExportLogs = [
      {
        id: 'log-1',
        type: 'IMPORT',
        format: 'CSV',
        fileName: 'contacts_import_mars_2026.csv',
        recordCount: 24,
        status: 'SUCCESS',
        performedBy: 'Dr. Chokri Ben Amar',
        createdAt: '2026-07-15T10:30:00Z'
      },
      {
        id: 'log-2',
        type: 'EXPORT',
        format: 'XLSX',
        fileName: 'export_annuaire_arsii.xlsx',
        recordCount: 48,
        status: 'SUCCESS',
        performedBy: 'Membre ARSII',
        createdAt: '2026-07-28T14:15:00Z'
      }
    ];
  }
}
