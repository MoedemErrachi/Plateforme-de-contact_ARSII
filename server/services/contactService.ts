import { DataStore, ContactEntity } from '../models/dataStore';
import { AppError } from '../utils/AppError';

export interface QueryContactsParams {
  page?: number;
  limit?: number;
  search?: string;
  country?: string;
  typeActeurId?: string;
  segmentId?: string;
}

export interface CreateContactPayload {
  firstName: string;
  lastName: string;
  email: string;
  organization: string;
  country: string;
  phone?: string;
  linkedinUrl?: string;
  expertiseDomain?: string;
  typeActeurId: string;
}

export interface UpdateContactPayload extends Partial<CreateContactPayload> {}

export class ContactService {
  private db = DataStore.getInstance();

  public async getContacts(params: QueryContactsParams) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(100, params.limit || 10));

    let filtered = [...this.db.contacts];

    if (params.search) {
      const q = params.search.toLowerCase().trim();
      filtered = filtered.filter(c => 
        c.firstName.toLowerCase().includes(q) ||
        c.lastName.toLowerCase().includes(q) ||
        c.organization.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
      );
    }

    if (params.country) {
      filtered = filtered.filter(c => c.country.toLowerCase() === params.country!.toLowerCase());
    }

    if (params.typeActeurId) {
      filtered = filtered.filter(c => c.typeActeurId === params.typeActeurId);
    }

    const totalRecords = filtered.length;
    const totalPages = Math.ceil(totalRecords / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedContacts = filtered.slice(startIndex, startIndex + limit);

    return {
      contacts: paginatedContacts,
      pagination: {
        totalRecords,
        totalPages,
        currentPage: page,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    };
  }

  public async getContactById(id: string) {
    const contact = this.db.contacts.find(c => c.id === id);
    if (!contact) {
      throw new AppError(`Contact avec l'ID ${id} non trouvé`, 404);
    }

    const typeActeur = this.db.typeActeurs.find(t => t.id === contact.typeActeurId);
    const exchangeNotes = this.db.exchangeNotes.filter(n => n.contactId === contact.id);
    const projects = this.db.projects.slice(0, 2); // Linked relations
    const tags = this.db.segments.slice(0, 2);

    return {
      ...contact,
      typeActeur,
      exchangeNotes,
      projects,
      tags
    };
  }

  public async createContact(payload: CreateContactPayload) {
    const existing = this.db.contacts.find(c => c.email.toLowerCase().trim() === payload.email.toLowerCase().trim());
    if (existing) {
      throw new AppError(`Un contact avec l'email ${payload.email} existe déjà`, 409);
    }

    const newContact: ContactEntity = {
      id: `contact-${Date.now()}`,
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      organization: payload.organization,
      country: payload.country,
      phone: payload.phone || '',
      linkedinUrl: payload.linkedinUrl || '',
      expertiseDomain: payload.expertiseDomain || '',
      typeActeurId: payload.typeActeurId
    };

    this.db.contacts.unshift(newContact);
    return newContact;
  }

  public async updateContact(id: string, payload: UpdateContactPayload) {
    const index = this.db.contacts.findIndex(c => c.id === id);
    if (index === -1) {
      throw new AppError(`Contact avec l'ID ${id} non trouvé`, 404);
    }

    if (payload.email) {
      const duplicate = this.db.contacts.find(c => c.id !== id && c.email.toLowerCase().trim() === payload.email!.toLowerCase().trim());
      if (duplicate) {
        throw new AppError(`Un autre contact avec l'email ${payload.email} existe déjà`, 409);
      }
    }

    const updated = {
      ...this.db.contacts[index],
      ...payload
    };

    this.db.contacts[index] = updated;
    return updated;
  }

  public async importContactsPreview(rows: Array<Partial<CreateContactPayload>>) {
    const preview = rows.map((row, index) => {
      const email = (row.email || '').toLowerCase().trim();
      const existingMatch = this.db.contacts.find(c => c.email.toLowerCase().trim() === email);

      const isValid = Boolean(email && email.includes('@'));
      const isDuplicate = Boolean(existingMatch);

      return {
        rowNumber: index + 1,
        inputData: row,
        status: !isValid ? 'INVALID' : isDuplicate ? 'DUPLICATE' : 'VALID',
        existingContactId: existingMatch?.id || null,
        message: !isValid 
          ? 'Email manquant ou invalide' 
          : isDuplicate 
          ? 'Un contact avec cette adresse e-mail existe déjà en base de données' 
          : 'Prêt pour importation'
      };
    });

    const totalInput = preview.length;
    const validCount = preview.filter(p => p.status === 'VALID').length;
    const duplicateCount = preview.filter(p => p.status === 'DUPLICATE').length;
    const invalidCount = preview.filter(p => p.status === 'INVALID').length;

    return {
      summary: {
        totalInput,
        validCount,
        duplicateCount,
        invalidCount
      },
      preview
    };
  }
}
