import { prisma } from '../db/prisma';
import { AppError } from '../utils/AppError';
import { Gender, ResearchCareerStage } from '@prisma/client';
import { randomUUID } from 'node:crypto';

const NA = 'N/A';

function clean(value?: string | null): string {
  return (value || '').trim();
}

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
  fullName?: string;
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

function splitFullName(fullName?: string | null): { firstName: string; lastName: string } {
  const parts = clean(fullName).split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: NA, lastName: NA };
  if (parts.length === 1) return { firstName: parts[0], lastName: NA };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function resolveNames(payload: CreateContactPayload): { firstName: string; lastName: string } {
  const first = clean(payload.firstName);
  const last = clean(payload.lastName);
  if (first || last) return { firstName: first || NA, lastName: last || NA };
  return splitFullName(payload.fullName);
}

function resolveEmail(email?: string | null): string {
  const e = clean(email).toLowerCase();
  if (e.includes('@')) return e;
  return `import_null_${randomUUID()}@euraxess.africa`;
}

function normalizeGender(value?: string): Gender {
  const v = (value || '').toUpperCase();
  const valid = ['FEMALE', 'MALE', 'NOT_SPECIFIED'] as const;
  return (valid as readonly string[]).includes(v) ? (v as Gender) : Gender.NOT_SPECIFIED;
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
          tags: { include: { tag: true } }
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
        tags: { include: { tag: true } }
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
      tags: { include: { tag: true } }
    } as const;
  }

  public async createContact(payload: CreateContactPayload) {
    const emailClean = resolveEmail(payload.email);

    const existing = await prisma.contact.findUnique({ where: { email: emailClean } });
    if (existing) {
      throw new AppError(`Un contact avec l'email ${payload.email} existe déjà`, 409);
    }

    const names = resolveNames(payload);

    const newContact = await prisma.contact.create({
      data: {
        firstName: names.firstName,
        lastName: names.lastName,
        email: emailClean,
        gender: normalizeGender(payload.gender),
        countryOfOrigin: clean(payload.countryOfOrigin) || NA,
        city: clean(payload.city) || null,
        phone: clean(payload.phone) || null,
        affiliation: clean(payload.affiliation) || NA,
        function: clean(payload.function) || null,
        experience: clean(payload.experience) || null,
        facultyDepartment: clean(payload.facultyDepartment) || null,
        researchCareerStage: normalizeCareerStage(payload.researchCareerStage),
        avatarUrl: clean(payload.avatarUrl) || null
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

    if (payload.firstName !== undefined) dataToUpdate.firstName = clean(payload.firstName) || NA;
    if (payload.lastName !== undefined) dataToUpdate.lastName = clean(payload.lastName) || NA;
    if (payload.email !== undefined) dataToUpdate.email = payload.email.toLowerCase().trim();
    if (payload.gender !== undefined) dataToUpdate.gender = normalizeGender(payload.gender);
    if (payload.countryOfOrigin !== undefined) dataToUpdate.countryOfOrigin = clean(payload.countryOfOrigin) || NA;
    if (payload.city !== undefined) dataToUpdate.city = clean(payload.city) || null;
    if (payload.phone !== undefined) dataToUpdate.phone = clean(payload.phone) || null;
    if (payload.affiliation !== undefined) dataToUpdate.affiliation = clean(payload.affiliation) || NA;
    if (payload.function !== undefined) dataToUpdate.function = clean(payload.function) || null;
    if (payload.experience !== undefined) dataToUpdate.experience = clean(payload.experience) || null;
    if (payload.facultyDepartment !== undefined) dataToUpdate.facultyDepartment = clean(payload.facultyDepartment) || null;
    if (payload.researchCareerStage !== undefined) dataToUpdate.researchCareerStage = normalizeCareerStage(payload.researchCareerStage);
    if (payload.avatarUrl !== undefined) dataToUpdate.avatarUrl = clean(payload.avatarUrl) || null;

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

  public async bulkSave(newContactsPayloads: CreateContactPayload[], updatedContactsPayloads: Array<{ id: string } & UpdateContactPayload>) {
    let createdCount = 0;
    let updatedCount = 0;

    for (const payload of newContactsPayloads) {
      const emailClean = resolveEmail(payload.email);
      const existing = await prisma.contact.findUnique({ where: { email: emailClean } });
      if (existing) {
        // Skip or update existing
        continue;
      }
      const names = resolveNames(payload);
      await prisma.contact.create({
        data: {
          firstName: names.firstName,
          lastName: names.lastName,
          email: emailClean,
          gender: normalizeGender(payload.gender),
          countryOfOrigin: clean(payload.countryOfOrigin) || NA,
          city: clean(payload.city) || null,
          phone: clean(payload.phone) || null,
          affiliation: clean(payload.affiliation) || NA,
          function: clean(payload.function) || null,
          experience: clean(payload.experience) || null,
          facultyDepartment: clean(payload.facultyDepartment) || null,
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
      if (updateItem.firstName !== undefined) dataToUpdate.firstName = clean(updateItem.firstName) || NA;
      if (updateItem.lastName !== undefined) dataToUpdate.lastName = clean(updateItem.lastName) || NA;
      if (updateItem.email !== undefined) dataToUpdate.email = updateItem.email.toLowerCase().trim();
      if (updateItem.gender !== undefined) dataToUpdate.gender = normalizeGender(updateItem.gender);
      if (updateItem.countryOfOrigin !== undefined) dataToUpdate.countryOfOrigin = clean(updateItem.countryOfOrigin) || NA;
      if (updateItem.city !== undefined) dataToUpdate.city = clean(updateItem.city) || null;
      if (updateItem.phone !== undefined) dataToUpdate.phone = clean(updateItem.phone) || null;
      if (updateItem.affiliation !== undefined) dataToUpdate.affiliation = clean(updateItem.affiliation) || NA;
      if (updateItem.function !== undefined) dataToUpdate.function = clean(updateItem.function) || null;
      if (updateItem.experience !== undefined) dataToUpdate.experience = clean(updateItem.experience) || null;
      if (updateItem.facultyDepartment !== undefined) dataToUpdate.facultyDepartment = clean(updateItem.facultyDepartment) || null;
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
      .map(r => clean(r.email).toLowerCase())
      .filter(e => e.includes('@'));

    const existingContacts = await prisma.contact.findMany({
      where: { email: { in: emails } },
      select: { id: true, email: true }
    });

    const existingEmailMap = new Map(existingContacts.map(c => [c.email.toLowerCase(), c.id]));

    const preview = rows.map((row, index) => {
      const rawEmail = clean(row.email);
      const emailValid = rawEmail.includes('@');
      const email = emailValid ? rawEmail.toLowerCase() : '';
      const hasNames = Boolean(clean(row.firstName) || clean(row.lastName) || clean(row.fullName));
      const existingId = emailValid ? existingEmailMap.get(email) || null : null;

      const isValid = emailValid || hasNames;
      const isDuplicate = Boolean(existingId);

      return {
        rowNumber: index + 1,
        inputData: row,
        status: !isValid ? 'INVALID' : isDuplicate ? 'DUPLICATE' : 'VALID',
        existingContactId: existingId,
        message: !isValid
          ? 'Nom et email manquants'
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
