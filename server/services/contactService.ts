import { prisma } from '../db/prisma';
import { AppError } from '../utils/AppError';
import { Prisma, Gender, ResearchCareerStage } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import ExcelJS from 'exceljs';


const NA = 'N/A';

// ---- Schéma d'export canonique (source de vérité partagée : list + export) ----
// Aligné sur `FieldKey`/`FIELD_HEADERS` du frontend (src/utils/exportCsv.ts).
export type ExportFieldKey =
  | 'email'
  | 'firstName'
  | 'lastName'
  | 'gender'
  | 'countryOfOrigin'
  | 'city'
  | 'phone'
  | 'affiliation'
  | 'function'
  | 'experience'
  | 'facultyDepartment'
  | 'researchCareerStage';

export const EXPORT_FIELD_KEYS: ExportFieldKey[] = [
  'email',
  'firstName',
  'lastName',
  'gender',
  'countryOfOrigin',
  'city',
  'phone',
  'affiliation',
  'function',
  'experience',
  'facultyDepartment',
  'researchCareerStage'
];

export const EXPORT_FIELD_HEADERS: Record<ExportFieldKey, string> = {
  email: 'Email',
  firstName: 'Prénom',
  lastName: 'Nom',
  gender: 'Genre',
  countryOfOrigin: "Pays d'origine",
  city: 'Ville',
  phone: 'Téléphone',
  affiliation: 'Affiliation',
  function: 'Fonction',
  experience: 'Expérience',
  facultyDepartment: 'Faculté / Département',
  researchCareerStage: 'Stade de carrière'
};

export const EXPORT_TAGS_HEADER = 'Étiquettes / Tags';

const EXPORT_GENDER_LABELS: Record<string, string> = {
  FEMALE: 'Femme',
  MALE: 'Homme',
  NOT_SPECIFIED: 'Non spécifié'
};

const EXPORT_STAGE_LABELS: Record<string, string> = {
  R1_FIRST_STAGE: 'R1 — Chercheur débutant (First Stage)',
  R2_RECOGNIZED: 'R2 — Chercheur reconnu (Recognised)',
  R3_ESTABLISHED: 'R3 — Chercheur établi (Established)',
  R4_LEADING: 'R4 — Chercheur leader (Leading)'
};

function clean(value?: string | null): string {
  return (value || '').trim();
}

// ---- Recherche tolérante (affiliation / facultyDepartment) ----
// Champs texte libre sujets aux variantes de saisie (casse, accents, sigles).
// On replie casse + accents via translate() (littéraux UTF-8, aucune extension
// ni DDL requis — `unaccent` n'est pas installé) et on compare en sous-chaîne.
const ACCENTS_IN = 'àáâãäåçèéêëìíîïñòóôõöùúûüýÿ';
const ACCENTS_OUT = 'aaaaaaceeeeiiiinooooouuuuyy';

const AFFILIATION_FOLD = Prisma.sql`translate(lower("affiliation"), ${ACCENTS_IN}, ${ACCENTS_OUT})`;
const FACULTY_DEPARTMENT_FOLD = Prisma.sql`translate(lower("facultyDepartment"), ${ACCENTS_IN}, ${ACCENTS_OUT})`;
const FIRST_NAME_FOLD = Prisma.sql`translate(lower("firstName"), ${ACCENTS_IN}, ${ACCENTS_OUT})`;
const LAST_NAME_FOLD = Prisma.sql`translate(lower("lastName"), ${ACCENTS_IN}, ${ACCENTS_OUT})`;
const FUNCTION_FOLD = Prisma.sql`translate(lower("function"), ${ACCENTS_IN}, ${ACCENTS_OUT})`;
const COUNTRY_OF_ORIGIN_FOLD = Prisma.sql`translate(lower("countryOfOrigin"), ${ACCENTS_IN}, ${ACCENTS_OUT})`;

const FOLD_MAP = new Map<string, string>();
ACCENTS_IN.split('').forEach((char, index) => FOLD_MAP.set(char, ACCENTS_OUT[index]));

/** Replie côté JS exactement comme translate() côté SQL (mêmes tables). */
function foldTerm(value: string): string {
  return value
    .toLowerCase()
    .split('')
    .map((char) => FOLD_MAP.get(char) ?? char)
    .join('');
}

/** Échappe les jokers LIKE pour une correspondance littérale. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function likePattern(value: string): string {
  return `%${escapeLike(foldTerm(value))}%`;
}

function csvCell(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export interface QueryContactsParams {
  page?: number;
  limit?: number;
  search?: string;
  countryOfOrigin?: string | string[];
  gender?: string | string[];
  careerStage?: string | string[];
  researchCareerStage?: string | string[];
  affiliation?: string;
  facultyDepartment?: string;
  tagId?: string | string[];
  segmentId?: string;
}

export interface ExportContactsParams extends QueryContactsParams {
  ids?: string[];
  fields?: string[];
  includeTags?: boolean;
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

// ---- Construction partagée du WHERE (list + export) ----
// Les filtres multi-valeurs sont exprimés en paramètres répétés (arrays).
// `careerStage` est conservé comme alias de `researchCareerStage` pour
// compatibilité avec le contrat du chatbot.

function toArray(value?: string | string[]): string[] {
  return Array.isArray(value) ? value.filter(Boolean) : value ? [value] : [];
}

function orCountryOfOrigin(values: string[]): Prisma.Sql {
  return Prisma.sql`(${Prisma.join(values.map(v => Prisma.sql`"countryOfOrigin" ILIKE ${v}`), ' OR ')})`;
}

function orGender(values: string[]): Prisma.Sql {
  return Prisma.sql`(${Prisma.join(values.map(v => Prisma.sql`"gender" = ${normalizeGender(v)}::"Gender"`), ' OR ')})`;
}

function orCareerStage(values: string[]): Prisma.Sql {
  return Prisma.sql`(${Prisma.join(
    values.map(v => Prisma.sql`"researchCareerStage" = ${normalizeCareerStage(v)}::"ResearchCareerStage"`),
    ' OR '
  )})`;
}

function orTagId(values: string[]): Prisma.Sql {
  return Prisma.sql`(${Prisma.join(
    values.map(tagId => Prisma.sql`EXISTS (
      SELECT 1 FROM "TagOnContact"
      WHERE "TagOnContact"."contactId" = "Contact"."id"
        AND "TagOnContact"."tagId" = ${tagId}
    )`),
    ' OR '
  )})`;
}

function orSegmentId(values: string[]): Prisma.Sql {
  return orTagId(values);
}

export class ContactService {
  /**
   * Construit les conditions WHERE partagées entre la liste paginée et l'export.
   * Zéro duplication : tout nouveau filtre ajouté ici profite aux deux endpoints.
   */
  private buildWhereConditions(params: QueryContactsParams): Prisma.Sql[] {
    const conditions: Prisma.Sql[] = [];

    if (params.search) {
      const q = params.search.trim();
      const pattern = likePattern(q);
      conditions.push(
        Prisma.sql`(
          ${FIRST_NAME_FOLD} LIKE ${pattern} OR
          ${LAST_NAME_FOLD} LIKE ${pattern} OR
          "email" ILIKE ${`%${escapeLike(foldTerm(q))}%`} OR
          ${AFFILIATION_FOLD} LIKE ${pattern} OR
          ${FACULTY_DEPARTMENT_FOLD} LIKE ${pattern} OR
          ${FUNCTION_FOLD} LIKE ${pattern} OR
          ${COUNTRY_OF_ORIGIN_FOLD} LIKE ${pattern} OR
          EXISTS (
            SELECT 1 FROM "TagOnContact" toc
            JOIN "Tag" t ON t."id" = toc."tagId"
            WHERE toc."contactId" = "Contact"."id"
              AND translate(lower(t."name"), ${ACCENTS_IN}, ${ACCENTS_OUT}) LIKE ${pattern}
          )
        )`
      );
    }

    const countries = toArray(params.countryOfOrigin);
    if (countries.length) {
      conditions.push(orCountryOfOrigin(countries));
    }

    const genders = toArray(params.gender);
    if (genders.length) {
      conditions.push(orGender(genders));
    }

    // Alias : `careerStage` (legacy) a priorité sur `researchCareerStage` (chatbot)
    const stages = toArray(params.careerStage).length ? toArray(params.careerStage) : toArray(params.researchCareerStage);
    if (stages.length) {
      conditions.push(orCareerStage(stages));
    }

    if (params.affiliation) {
      conditions.push(Prisma.sql`${AFFILIATION_FOLD} LIKE ${likePattern(params.affiliation)}`);
    }

    if (params.facultyDepartment) {
      conditions.push(Prisma.sql`${FACULTY_DEPARTMENT_FOLD} LIKE ${likePattern(params.facultyDepartment)}`);
    }

    const tagIds = toArray(params.tagId);
    if (tagIds.length) {
      conditions.push(orTagId(tagIds));
    }

    const segmentIds = toArray(params.segmentId);
    if (segmentIds.length) {
      conditions.push(orSegmentId(segmentIds));
    }

    return conditions;
  }

  /**
   * Conditions de l'export : le mode `ids` prime sur les filtres.
   */
  private exportConditions(params: ExportContactsParams): Prisma.Sql[] {
    const ids = toArray(params.ids);
    if (ids.length) {
      return [Prisma.sql`"id" IN (${Prisma.join(ids.map(id => Prisma.sql`${id}`))})`];
    }
    return this.buildWhereConditions(params);
  }

  private whereSql(conditions: Prisma.Sql[]): Prisma.Sql {
    return conditions.length ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}` : Prisma.empty;
  }

  public async getContacts(params: QueryContactsParams) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(100, params.limit || 20));
    const skip = (page - 1) * limit;

    const conditions = this.buildWhereConditions(params);
    const whereSql = this.whereSql(conditions);

    const [totalRecords, idsResult] = await Promise.all([
      prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*)::bigint AS n FROM "Contact" ${whereSql}`,
      prisma.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Contact" ${whereSql}
        ORDER BY "createdAt" DESC
        LIMIT ${limit} OFFSET ${skip}
      `,
    ]);

    const count = Number(totalRecords[0]?.n ?? 0);
    const ids = idsResult.map((row) => row.id);
    const contacts = ids.length
      ? await prisma.contact.findMany({
          where: { id: { in: ids } },
          orderBy: { createdAt: 'desc' },
          include: this.contactInclude(),
        })
      : [];

    const totalPages = Math.ceil(count / limit) || 1;

    return {
      contacts,
      pagination: {
        page,
        limit,
        totalCount: count,
        totalPages,
        currentPage: page,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        totalRecords: count,
      },
    };
  }

  /**
   * Nombre total de contacts correspondant à l'export (header X-Export-Count).
   */
  public async countExport(params: ExportContactsParams): Promise<number> {
    const whereSql = this.whereSql(this.exportConditions(params));
    const rows = await prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*)::bigint AS n FROM "Contact" ${whereSql}`;
    return Number(rows[0]?.n ?? 0);
  }

  /**
   * Export par lot (cursor sur id) pour ne jamais charger toute la table en mémoire.
   * Sert aussi bien le CSV (stream HTTP) que le JSON.
   */
  public async *streamExport(params: ExportContactsParams): AsyncGenerator<any> {
    const conditions = this.exportConditions(params);
    const BATCH = 200;
    let lastId: string | null = null;

    while (true) {
      const cursorCondition = lastId ? Prisma.sql`"id" > ${lastId}` : null;
      const all = cursorCondition ? [...conditions, cursorCondition] : conditions;
      const whereSql = this.whereSql(all);

      const idRows = await prisma.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Contact" ${whereSql}
        ORDER BY "id" ASC
        LIMIT ${BATCH}
      `;

      if (!idRows.length) break;

      const contacts = await prisma.contact.findMany({
        where: { id: { in: idRows.map(row => row.id) } },
        orderBy: { id: 'asc' },
        include: this.contactInclude(),
      });

      for (const contact of contacts) {
        yield contact;
      }

      if (idRows.length < BATCH) break;
      lastId = idRows[idRows.length - 1].id;
    }
  }

  /**
   * Résout les colonnes d'export (ordre canonique) à partir du paramètre
   * `fields` (optionnel) et du flag `includeTags`. Zéro champ requis => tous.
   */
  public resolveExportColumns(fields?: string[], includeTags?: boolean): { keys: ExportFieldKey[]; headers: string[] } {
    const requested = (fields || []).filter(Boolean);
    const keys = requested.length
      ? EXPORT_FIELD_KEYS.filter(k => requested.includes(k))
      : [...EXPORT_FIELD_KEYS];
    const headers = keys.map(k => EXPORT_FIELD_HEADERS[k]);
    if (includeTags) headers.push(EXPORT_TAGS_HEADER);
    return { keys, headers };
  }

  /** Valeur lisible (labels localisés) d'un champ pour l'export. */
  public exportFieldValue(contact: any, key: ExportFieldKey): string {
    switch (key) {
      case 'gender':
        return EXPORT_GENDER_LABELS[contact.gender] || contact.gender || '';
      case 'researchCareerStage':
        return EXPORT_STAGE_LABELS[contact.researchCareerStage] || contact.researchCareerStage || '';
      case 'firstName':
      case 'lastName':
        return contact[key] || '';
      default:
        return String(contact[key] ?? '');
    }
  }

  /** Noms des étiquettes d'un contact (relation `tags: { include: { tag } }`). */
  public tagNames(contact: any): string[] {
    return (contact.tags || [])
      .map((t: any) => t?.tag?.name || '')
      .filter(Boolean);
  }

  /** Cellules CSV (échappées) d'un contact selon les colonnes résolues. */
  public exportCsvCells(contact: any, keys: ExportFieldKey[], includeTags?: boolean): string[] {
    const cells = keys.map(k => csvCell(this.exportFieldValue(contact, k)));
    if (includeTags) cells.push(csvCell(this.tagNames(contact).join('; ')));
    return cells;
  }

  /** Matérialise toutes les lignes de l'export (XLSX / PDF / JSON). */
  public async collectExportRows(params: ExportContactsParams): Promise<any[]> {
    const rows: any[] = [];
    for await (const contact of this.streamExport(params)) {
      rows.push(contact);
    }
    return rows;
  }

  /** Buffer XLSX (ExcelJS) avec en-têtes surlignés, conformément au contrat front. */
  public async buildXlsxBuffer(
    params: ExportContactsParams,
    keys: ExportFieldKey[],
    includeTags?: boolean
  ): Promise<Buffer> {
    const rows = await this.collectExportRows(params);
    const { headers } = this.resolveExportColumns(keys, includeTags);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Contacts EURAXESS Africa');

    const headerRow = worksheet.addRow(headers);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF005596' } };

    for (const contact of rows) {
      worksheet.addRow(keys.map(k => this.exportFieldValue(contact, k)).concat(includeTags ? [this.tagNames(contact).join('; ')] : []));
    }

    worksheet.columns.forEach(col => {
      col.width = 22;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
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
   * Liste distincte des pays d'origine (pills de filtrage du sidebar),
   * indépendante de la page de résultats courante.
   */
  public async getDistinctCountries(): Promise<string[]> {
    const rows = await prisma.$queryRaw<{ country: string }[]>`
      SELECT DISTINCT "countryOfOrigin" AS country FROM "Contact"
      WHERE "countryOfOrigin" IS NOT NULL AND "countryOfOrigin" <> ''
      ORDER BY "countryOfOrigin" ASC
    `;
    return rows.map(row => row.country);
  }

  private static readonly GROUP_BY_ALLOWED = new Set([
    'gender',
    'countryOfOrigin',
    'facultyDepartment',
    'researchCareerStage'
  ]);

  /**
   * Statistiques agrégées par gender / countryOfOrigin / facultyDepartment /
   * researchCareerStage, en appliquant les mêmes filtres que la liste et
   * l'export (WHERE partagé). Retourne une map `label -> count`.
   */
  public async getAggregation(groupBy: string, params: QueryContactsParams): Promise<Record<string, number>> {
    if (!ContactService.GROUP_BY_ALLOWED.has(groupBy)) {
      throw new AppError(`group_by invalide: ${groupBy}`, 400);
    }
    const column = `"${groupBy}"`;
    const whereSql = this.whereSql(this.buildWhereConditions(params));
    const rows = await prisma.$queryRaw<{ label: string | null; n: bigint }[]>`
      SELECT ${Prisma.raw(column)} AS label, COUNT(*)::bigint AS n
      FROM "Contact"
      ${whereSql}
      GROUP BY ${Prisma.raw(column)}
      ORDER BY n DESC
    `;
    const aggregation: Record<string, number> = {};
    for (const row of rows) {
      const label = row.label === null || row.label === '' ? 'Non renseigné' : String(row.label);
      aggregation[label] = Number(row.n);
    }
    return aggregation;
  }

  /**
   * Nombre de contacts dont l'email matche un motif (ex. emails temporaires
   * `import_null_...` créés par les imports). Le motif est échappé (LIKE littéral).
   */
  public async countByEmailPattern(pattern: string): Promise<number> {
    const rows = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*)::bigint AS n FROM "Contact"
      WHERE "email" ILIKE ${`${escapeLike(pattern)}%`}
    `;
    return Number(rows[0]?.n ?? 0);
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
    if (payload.countryOfOrigin !== undefined) dataToUpdate.countryOfOrigin = clean(payload.countryOfOrigin) || null;
    if (payload.city !== undefined) dataToUpdate.city = clean(payload.city) || null;
    if (payload.phone !== undefined) dataToUpdate.phone = clean(payload.phone) || null;
    if (payload.affiliation !== undefined) dataToUpdate.affiliation = clean(payload.affiliation) || null;
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
        countryOfOrigin: clean(payload.countryOfOrigin) || null,
          city: clean(payload.city) || null,
          phone: clean(payload.phone) || null,
        affiliation: clean(payload.affiliation) || null,
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
