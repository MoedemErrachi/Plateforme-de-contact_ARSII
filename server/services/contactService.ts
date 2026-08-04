import { prisma } from '../db/prisma';
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
  firstName?: string;
  lastName?: string;
  name?: string;
  title?: string;
  email: string;
  organization: string;
  country: string;
  phone?: string;
  linkedinUrl?: string;
  linkedin?: string;
  expertiseDomain?: string;
  typeActeurId?: string;
  actorType?: string;
}

export interface UpdateContactPayload extends Partial<CreateContactPayload> {}

export class ContactService {
  public async getContacts(params: QueryContactsParams) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(100, params.limit || 10));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (params.search) {
      const q = params.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { organization: { contains: q, mode: 'insensitive' } },
        { title: { contains: q, mode: 'insensitive' } },
        { expertise: { hasSome: [q] } }
      ];
    }

    if (params.country) {
      where.country = { equals: params.country, mode: 'insensitive' };
    }

    if (params.typeActeurId) {
      where.OR = [
        { actorTypeId: params.typeActeurId },
        { actorType: params.typeActeurId }
      ];
    }

    if (params.segmentId) {
      where.tags = {
        some: {
          tagId: params.segmentId
        }
      };
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
          tags: {
            include: { tag: true }
          },
          projects: {
            include: { project: true }
          },
          exchangeNotes: true
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
        tags: {
          include: { tag: true }
        },
        projects: {
          include: { project: true }
        },
        exchangeNotes: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!contact) {
      throw new AppError(`Contact avec l'ID ${id} non trouvé`, 404);
    }

    return contact;
  }

  public async createContact(payload: CreateContactPayload) {
    const emailClean = payload.email.toLowerCase().trim();

    const existing = await prisma.contact.findUnique({
      where: { email: emailClean }
    });

    if (existing) {
      throw new AppError(`Un contact avec l'email ${payload.email} existe déjà`, 409);
    }

    const name = payload.name || `${payload.firstName || ''} ${payload.lastName || ''}`.trim() || 'Nouveau Contact';
    const initials = name
      .split(' ')
      .filter(Boolean)
      .map(part => part[0])
      .join('')
      .substring(0, 2)
      .toUpperCase() || 'NC';

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
        expertise: payload.expertiseDomain ? [payload.expertiseDomain] : [],
        interventionZones: payload.country ? [payload.country] : []
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
    const existing = await prisma.contact.findUnique({
      where: { id }
    });

    if (!existing) {
      throw new AppError(`Contact avec l'ID ${id} non trouvé`, 404);
    }

    if (payload.email) {
      const emailClean = payload.email.toLowerCase().trim();
      if (emailClean !== existing.email.toLowerCase()) {
        const duplicate = await prisma.contact.findUnique({
          where: { email: emailClean }
        });
        if (duplicate) {
          throw new AppError(`Un autre contact avec l'email ${payload.email} existe déjà`, 409);
        }
      }
    }

    const dataToUpdate: any = {};
    if (payload.name || payload.firstName || payload.lastName) {
      const name = payload.name || `${payload.firstName || ''} ${payload.lastName || ''}`.trim();
      dataToUpdate.name = name;
      dataToUpdate.initials = name
        .split(' ')
        .filter(Boolean)
        .map(part => part[0])
        .join('')
        .substring(0, 2)
        .toUpperCase();
    }
    if (payload.email) dataToUpdate.email = payload.email.toLowerCase().trim();
    if (payload.organization !== undefined) dataToUpdate.organization = payload.organization;
    if (payload.country !== undefined) dataToUpdate.country = payload.country;
    if (payload.phone !== undefined) dataToUpdate.phone = payload.phone;
    if (payload.linkedinUrl !== undefined || payload.linkedin !== undefined) {
      dataToUpdate.linkedin = payload.linkedinUrl || payload.linkedin || '';
    }
    if (payload.typeActeurId !== undefined) dataToUpdate.actorTypeId = payload.typeActeurId;
    if (payload.actorType !== undefined) dataToUpdate.actorType = payload.actorType;
    if (payload.expertiseDomain) dataToUpdate.expertise = [payload.expertiseDomain];

    const updatedContact = await prisma.contact.update({
      where: { id },
      data: dataToUpdate,
      include: {
        typeActeur: true,
        tags: { include: { tag: true } },
        projects: { include: { project: true } },
        exchangeNotes: true
      }
    });

    return updatedContact;
  }

  public async importContactsPreview(rows: Array<Partial<CreateContactPayload>>) {
    const emails = rows
      .map(r => (r.email || '').toLowerCase().trim())
      .filter(Boolean);

    const existingContacts = await prisma.contact.findMany({
      where: {
        email: { in: emails }
      },
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
