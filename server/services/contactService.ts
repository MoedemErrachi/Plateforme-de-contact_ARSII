import { prisma } from '../db/prisma';
import { AppError } from '../utils/AppError';
import { NoteType, Gender, ResearchCareerStage } from '@prisma/client';

export interface QueryContactsParams {
  page?: number;
  limit?: number;
  search?: string;
  countryOfOrigin?: string;
  gender?: string;
  careerStage?: string;
  affiliation?: string;
  tagId?: string;
  segmentId?: string;
}

export interface CreateContactPayload {
  firstName?: string;
  lastName?: string;
  email: string;
  gender?: string;
  countryOfOrigin?: string;
  city?: string;
  phone?: string;
  affiliation?: string;
  function?: string;
  experience?: string;
  facultyDepartment?: string;
  researchCareerStage?: string;
  avatarUrl?: string;
  tagIds?: string[];
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

function normalizeGender(value?: string): Gender {
  const v = (value || '').toUpperCase();
  const valid = ['FEMALE', 'MALE', 'OTHER', 'PREFER_NOT_TO_SAY'] as const;
  return (valid as readonly string[]).includes(v) ? (v as Gender) : Gender.PREFER_NOT_TO_SAY;
}

function normalizeCareerStage(value?: string): ResearchCareerStage {
  const v = (value || '').toUpperCase();
  const valid = ['R1_FIRST_STAGE', 'R2_RECOGNIZED', 'R3_ESTABLISHED', 'R4_LEADING'] as const;
  return (valid as readonly string[]).includes(v) ? (v as ResearchCareerStage) : ResearchCareerStage.R1_FIRST_STAGE;
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
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { affiliation: { contains: q, mode: 'insensitive' } },
        { function: { contains: q, mode: 'insensitive' } }
      ];
    }

    if (params.countryOfOrigin) {
      where.countryOfOrigin = { equals: params.countryOfOrigin, mode: 'insensitive' };
    }

    if (params.gender) {
      where.gender = normalizeGender(params.gender);
    }

    if (params.careerStage) {
      where.researchCareerStage = normalizeCareerStage(params.careerStage);
    }

    if (params.affiliation) {
      where.affiliation = { contains: params.affiliation, mode: 'insensitive' };
    }

    if (params.tagId) {
      where.tags = { some: { tagId: params.tagId } };
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
          tags: { include: { tag: true } },
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
        tags: { include: { tag: true } },
        exchangeNotes: { orderBy: { createdAt: 'desc' } }
      }
    });

    if (!contact) {
      throw new AppError(`Contact avec l'ID ${id} non trouvé`, 404);
    }

    return contact;
  }

  /**
   * Replaces all tags of a contact with the given tag IDs (validates existence first).
   */
  private async setContactTags(contactId: string, tagIds: string[]) {
    const uniqueIds = Array.from(new Set(tagIds)).filter(Boolean);
    const existingTags = await prisma.tag.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true }
    });
    const validIds = existingTags.map(t => t.id);

    await prisma.$transaction([
      prisma.tagOnContact.deleteMany({ where: { contactId } }),
      prisma.tagOnContact.createMany({
        data: validIds.map(tagId => ({ contactId, tagId })),
        skipDuplicates: true
      })
    ]);
  }

  private contactInclude() {
    return {
      tags: { include: { tag: true } },
      exchangeNotes: { orderBy: { createdAt: 'desc' } }
    } as const;
  }

  public async createContact(payload: CreateContactPayload) {
    const emailClean = payload.email.toLowerCase().trim();

    const existing = await prisma.contact.findUnique({ where: { email: emailClean } });
    if (existing) {
      throw new AppError(`Un contact avec l'email ${payload.email} existe déjà`, 409);
    }

    const name = buildName(payload);

    const newContact = await prisma.contact.create({
      data: {
        firstName: (payload.firstName || '').trim() || name.split(' ')[0] || '',
        lastName: (payload.lastName || '').trim() || name.split(' ').slice(1).join(' ') || '',
        email: emailClean,
        gender: normalizeGender(payload.gender),
        countryOfOrigin: payload.countryOfOrigin || '',
        city: payload.city || '',
        phone: payload.phone || '',
        affiliation: payload.affiliation || '',
        function: payload.function || null,
        experience: payload.experience || null,
        facultyDepartment: payload.facultyDepartment || null,
        researchCareerStage: normalizeCareerStage(payload.researchCareerStage),
        avatarUrl: payload.avatarUrl || null
      }
    });

    if (payload.tagIds?.length) {
      await this.setContactTags(newContact.id, payload.tagIds);
    }

    return prisma.contact.findUnique({
      where: { id: newContact.id },
      include: this.contactInclude()
    });
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

    if (payload.firstName !== undefined) dataToUpdate.firstName = payload.firstName.trim();
    if (payload.lastName !== undefined) dataToUpdate.lastName = payload.lastName.trim();
    if (payload.email !== undefined) dataToUpdate.email = payload.email.toLowerCase().trim();
    if (payload.gender !== undefined) dataToUpdate.gender = normalizeGender(payload.gender);
    if (payload.countryOfOrigin !== undefined) dataToUpdate.countryOfOrigin = payload.countryOfOrigin;
    if (payload.city !== undefined) dataToUpdate.city = payload.city;
    if (payload.phone !== undefined) dataToUpdate.phone = payload.phone;
    if (payload.affiliation !== undefined) dataToUpdate.affiliation = payload.affiliation;
    if (payload.function !== undefined) dataToUpdate.function = payload.function || null;
    if (payload.experience !== undefined) dataToUpdate.experience = payload.experience || null;
    if (payload.facultyDepartment !== undefined) dataToUpdate.facultyDepartment = payload.facultyDepartment || null;
    if (payload.researchCareerStage !== undefined) dataToUpdate.researchCareerStage = normalizeCareerStage(payload.researchCareerStage);
    if (payload.avatarUrl !== undefined) dataToUpdate.avatarUrl = payload.avatarUrl || null;

    const updatedContact = await prisma.contact.update({
      where: { id },
      data: dataToUpdate,
      include: this.contactInclude()
    });

    if (Array.isArray(payload.tagIds)) {
      await this.setContactTags(id, payload.tagIds);
      return prisma.contact.findUnique({
        where: { id },
        include: this.contactInclude()
      });
    }

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
      await prisma.contact.create({
        data: {
          firstName: (payload.firstName || '').trim() || name.split(' ')[0] || '',
          lastName: (payload.lastName || '').trim() || name.split(' ').slice(1).join(' ') || '',
          email: emailClean,
          gender: normalizeGender(payload.gender),
          countryOfOrigin: payload.countryOfOrigin || '',
          city: payload.city || '',
          phone: payload.phone || '',
          affiliation: payload.affiliation || '',
          function: payload.function || null,
          experience: payload.experience || null,
          facultyDepartment: payload.facultyDepartment || null,
          researchCareerStage: normalizeCareerStage(payload.researchCareerStage)
        }
      });
      createdCount++;
    }

    for (const updateItem of updatedContactsPayloads) {
      if (!updateItem.id) continue;
      const existing = await prisma.contact.findUnique({ where: { id: updateItem.id } });
      if (!existing) continue;

      const dataToUpdate: any = {};
      if (updateItem.firstName !== undefined) dataToUpdate.firstName = updateItem.firstName.trim();
      if (updateItem.lastName !== undefined) dataToUpdate.lastName = updateItem.lastName.trim();
      if (updateItem.email !== undefined) dataToUpdate.email = updateItem.email.toLowerCase().trim();
      if (updateItem.gender !== undefined) dataToUpdate.gender = normalizeGender(updateItem.gender);
      if (updateItem.countryOfOrigin !== undefined) dataToUpdate.countryOfOrigin = updateItem.countryOfOrigin;
      if (updateItem.city !== undefined) dataToUpdate.city = updateItem.city;
      if (updateItem.phone !== undefined) dataToUpdate.phone = updateItem.phone;
      if (updateItem.affiliation !== undefined) dataToUpdate.affiliation = updateItem.affiliation;
      if (updateItem.function !== undefined) dataToUpdate.function = updateItem.function || null;
      if (updateItem.experience !== undefined) dataToUpdate.experience = updateItem.experience || null;
      if (updateItem.facultyDepartment !== undefined) dataToUpdate.facultyDepartment = updateItem.facultyDepartment || null;
      if (updateItem.researchCareerStage !== undefined) dataToUpdate.researchCareerStage = normalizeCareerStage(updateItem.researchCareerStage);

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
