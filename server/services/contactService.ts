import { prisma } from '../db/prisma';
import { AppError } from '../utils/AppError';
import { NoteType } from '@prisma/client';

export interface QueryContactsParams {
  page?: number;
  limit?: number;
  search?: string;
  country?: string;
  typeActeurId?: string;
  segmentId?: string;
}

export interface CreateContactPayload {
  firstName?: string;
  lastName?: string;
  name?: string;
  title?: string;
  email: string;
  organization?: string;
  country?: string;
  phone?: string;
  linkedinUrl?: string;
  linkedin?: string;
  expertiseDomain?: string;
  expertise?: string[];
  interventionZones?: string[];
  typeActeurId?: string;
  actorType?: string;
}

export interface UpdateContactPayload extends Partial<CreateContactPayload> {}

export interface CreateNotePayload {
  title: string;
  content: string;
  type?: string;
  date?: string;
  relativeTime?: string;
  author?: string;
  authorInitials?: string;
  projectName?: string;
}

function buildName(payload: CreateContactPayload): string {
  if (payload.name) return payload.name.trim();
  const first = (payload.firstName || '').trim();
  const last = (payload.lastName || '').trim();
  if (first && last) return `${first} ${last}`;
  return first || last || 'Nouveau Contact';
}

function buildInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map(p => p[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'NC';
}

export class ContactService {
  public async getContacts(params: QueryContactsParams) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(100, params.limit || 50));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (params.search) {
      const q = params.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { organization: { contains: q, mode: 'insensitive' } },
        { title: { contains: q, mode: 'insensitive' } }
      ];
    }

    if (params.country) {
      where.country = { equals: params.country, mode: 'insensitive' };
    }

    if (params.typeActeurId) {
      where.OR = [
        { actorTypeId: params.typeActeurId },
        { actorType: { equals: params.typeActeurId, mode: 'insensitive' } }
      ];
    }

    if (params.segmentId) {
      where.tags = { some: { tagId: params.segmentId } };
    }

    const [totalRecords, contacts] = await Promise.all([
      prisma.contact.count({ where }),
      prisma.contact.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          typeActeur: true,
          tags: { include: { tag: true } },
          projects: { include: { project: true } },
          exchangeNotes: { orderBy: { createdAt: 'desc' } }
        }
      })
    ]);

    const totalPages = Math.ceil(totalRecords / limit) || 1;

    return {
      contacts,
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
    const contact = await prisma.contact.findUnique({
      where: { id },
      include: {
        typeActeur: true,
        tags: { include: { tag: true } },
        projects: { include: { project: true } },
        exchangeNotes: { orderBy: { createdAt: 'desc' } }
      }
    });

    if (!contact) {
      throw new AppError(`Contact avec l'ID ${id} non trouvé`, 404);
    }

    return contact;
  }

  public async createContact(payload: CreateContactPayload) {
    const emailClean = payload.email.toLowerCase().trim();

    const existing = await prisma.contact.findUnique({ where: { email: emailClean } });
    if (existing) {
      throw new AppError(`Un contact avec l'email ${payload.email} existe déjà`, 409);
    }

    const name = buildName(payload);
    const initials = buildInitials(name);

    const newContact = await prisma.contact.create({
      data: {
        name,
        initials,
        title: payload.title || 'Membre Réseau',
        organization: payload.organization || '',
        email: emailClean,
        phone: payload.phone || '',
        linkedin: payload.linkedinUrl || payload.linkedin || '',
        country: payload.country || 'Tunisie',
        actorTypeId: payload.typeActeurId || null,
        actorType: payload.actorType || 'PME',
        expertise: payload.expertise?.length
          ? payload.expertise
          : payload.expertiseDomain
          ? [payload.expertiseDomain]
          : [],
        interventionZones: payload.interventionZones?.length
          ? payload.interventionZones
          : payload.country
          ? [payload.country]
          : []
      },
      include: {
        typeActeur: true,
        tags: { include: { tag: true } },
        projects: { include: { project: true } },
        exchangeNotes: true
      }
    });

    return newContact;
  }

  public async updateContact(id: string, payload: UpdateContactPayload) {
    const existing = await prisma.contact.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError(`Contact avec l'ID ${id} non trouvé`, 404);
    }

    if (payload.email) {
      const emailClean = payload.email.toLowerCase().trim();
      if (emailClean !== existing.email.toLowerCase()) {
        const duplicate = await prisma.contact.findUnique({ where: { email: emailClean } });
        if (duplicate) {
          throw new AppError(`Un autre contact avec l'email ${payload.email} existe déjà`, 409);
        }
      }
    }

    const dataToUpdate: any = {};

    const newName = buildName({ ...existing, ...payload } as CreateContactPayload);
    if (newName !== existing.name) {
      dataToUpdate.name = newName;
      dataToUpdate.initials = buildInitials(newName);
    }
    if (payload.title !== undefined) dataToUpdate.title = payload.title;
    if (payload.email !== undefined) dataToUpdate.email = payload.email.toLowerCase().trim();
    if (payload.organization !== undefined) dataToUpdate.organization = payload.organization;
    if (payload.country !== undefined) dataToUpdate.country = payload.country;
    if (payload.phone !== undefined) dataToUpdate.phone = payload.phone;
    if (payload.linkedinUrl !== undefined || payload.linkedin !== undefined) {
      dataToUpdate.linkedin = payload.linkedinUrl || payload.linkedin || '';
    }
    if (payload.typeActeurId !== undefined) dataToUpdate.actorTypeId = payload.typeActeurId;
    if (payload.actorType !== undefined) dataToUpdate.actorType = payload.actorType;
    if (payload.expertise !== undefined) dataToUpdate.expertise = payload.expertise;
    if (payload.expertiseDomain !== undefined) dataToUpdate.expertise = [payload.expertiseDomain];
    if (payload.interventionZones !== undefined) dataToUpdate.interventionZones = payload.interventionZones;

    const updatedContact = await prisma.contact.update({
      where: { id },
      data: dataToUpdate,
      include: {
        typeActeur: true,
        tags: { include: { tag: true } },
        projects: { include: { project: true } },
        exchangeNotes: { orderBy: { createdAt: 'desc' } }
      }
    });

    return updatedContact;
  }

  public async deleteContact(id: string) {
    const existing = await prisma.contact.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError(`Contact avec l'ID ${id} non trouvé`, 404);
    }

    await prisma.contact.delete({ where: { id } });
    return { success: true, deletedId: id };
  }

  public async addNote(contactId: string, payload: CreateNotePayload) {
    const existing = await prisma.contact.findUnique({ where: { id: contactId } });
    if (!existing) {
      throw new AppError(`Contact avec l'ID ${contactId} non trouvé`, 404);
    }

    const noteTypeMap: Record<string, NoteType> = {
      MEETING: NoteType.MEETING,
      EMAIL: NoteType.EMAIL,
      CALL: NoteType.CALL,
      NOTE: NoteType.NOTE,
      meeting: NoteType.MEETING,
      email: NoteType.EMAIL,
      call: NoteType.CALL,
      note: NoteType.NOTE
    };

    const note = await prisma.exchangeNote.create({
      data: {
        contactId,
        title: payload.title,
        content: payload.content,
        type: noteTypeMap[payload.type || 'NOTE'] || NoteType.NOTE,
        date: payload.date || new Date().toISOString().split('T')[0],
        relativeTime: payload.relativeTime || 'À l\'instant',
        author: payload.author || null,
        authorInitials: payload.authorInitials || null,
        projectName: payload.projectName || null
      }
    });

    return note;
  }

  public async bulkSave(newContactsPayloads: CreateContactPayload[], updatedContactsPayloads: Array<{ id: string } & UpdateContactPayload>) {
    let createdCount = 0;
    let updatedCount = 0;

    for (const payload of newContactsPayloads) {
      if (!payload.email) continue;
      const emailClean = payload.email.toLowerCase().trim();
      const existing = await prisma.contact.findUnique({ where: { email: emailClean } });
      if (existing) {
        // Skip or update existing
        continue;
      }
      const name = buildName(payload);
      const initials = buildInitials(name);
      await prisma.contact.create({
        data: {
          name,
          initials,
          title: payload.title || 'Partenaire R&I',
          organization: payload.organization || '',
          email: emailClean,
          phone: payload.phone || '',
          linkedin: payload.linkedinUrl || payload.linkedin || '',
          country: payload.country || 'Sénégal',
          actorType: payload.actorType || 'Labo de recherche',
          expertise: payload.expertise || [],
          interventionZones: payload.interventionZones || [payload.country || 'Sénégal']
        }
      });
      createdCount++;
    }

    for (const updateItem of updatedContactsPayloads) {
      if (!updateItem.id) continue;
      const existing = await prisma.contact.findUnique({ where: { id: updateItem.id } });
      if (!existing) continue;

      const dataToUpdate: any = {};
      const newName = buildName({ ...existing, ...updateItem } as CreateContactPayload);
      if (newName !== existing.name) {
        dataToUpdate.name = newName;
        dataToUpdate.initials = buildInitials(newName);
      }
      if (updateItem.title !== undefined) dataToUpdate.title = updateItem.title;
      if (updateItem.organization !== undefined) dataToUpdate.organization = updateItem.organization;
      if (updateItem.country !== undefined) dataToUpdate.country = updateItem.country;
      if (updateItem.phone !== undefined) dataToUpdate.phone = updateItem.phone;
      if (updateItem.actorType !== undefined) dataToUpdate.actorType = updateItem.actorType;
      if (updateItem.expertise !== undefined) dataToUpdate.expertise = updateItem.expertise;

      await prisma.contact.update({
        where: { id: updateItem.id },
        data: dataToUpdate
      });
      updatedCount++;
    }

    return { createdCount, updatedCount };
  }

  public async importContactsPreview(rows: Array<Partial<CreateContactPayload>>) {
    const emails = rows
      .map(r => (r.email || '').toLowerCase().trim())
      .filter(Boolean);

    const existingContacts = await prisma.contact.findMany({
      where: { email: { in: emails } },
      select: { id: true, email: true }
    });

    const existingEmailMap = new Map(existingContacts.map(c => [c.email.toLowerCase(), c.id]));

    const preview = rows.map((row, index) => {
      const email = (row.email || '').toLowerCase().trim();
      const existingId = existingEmailMap.get(email) || null;

      const isValid = Boolean(email && email.includes('@'));
      const isDuplicate = Boolean(existingId);

      return {
        rowNumber: index + 1,
        inputData: row,
        status: !isValid ? 'INVALID' : isDuplicate ? 'DUPLICATE' : 'VALID',
        existingContactId: existingId,
        message: !isValid
          ? 'Email manquant ou invalide'
          : isDuplicate
          ? 'Un contact avec cette adresse e-mail existe déjà en base de données'
          : 'Prêt pour importation'
      };
    });

    return {
      summary: {
        totalInput: preview.length,
        validCount: preview.filter(p => p.status === 'VALID').length,
        duplicateCount: preview.filter(p => p.status === 'DUPLICATE').length,
        invalidCount: preview.filter(p => p.status === 'INVALID').length
      },
      preview
    };
  }
}
