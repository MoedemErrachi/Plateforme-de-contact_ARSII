import { prisma } from '../config/prisma';
import { AppError } from '../utils/appError';
import { Prisma, Gender, ResearchCareerStage } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import ExcelJS from 'exceljs';
import { csvCell } from '../utils/csv';


const NA = 'N/A';

function previewRowStatus(isValid: boolean, isDuplicate: boolean): 'INVALID' | 'DUPLICATE' | 'VALID' {
  if (!isValid) return 'INVALID';
  if (isDuplicate) return 'DUPLICATE';
  return 'VALID';
}

function previewRowMessage(isValid: boolean, isDuplicate: boolean): string {
  if (!isValid) return 'Nom et email manquants';
  if (isDuplicate) return 'Un contact avec cette adresse e-mail existe déjà en base de données';
  return 'Prêt pour importation';
}

function friendlyRowError(err: any, context: string): string {
  const raw: string = err?.message || 'Erreur inconnue';
  if (raw.includes('Unique constraint') || raw.includes('unique constraint')) {
    return `${context} : e-mail déjà existant`;
  }
  if (raw.includes('Foreign key') || raw.includes('foreign key') || raw.includes('Record to connect')) {
    return `${context} : référence introuvable (tag ou contact absent)`;
  }
  if (raw.includes('Invalid input') || raw.includes('invalid input')) {
    return `${context} : données invalides (${raw.slice(0, 120)})`;
  }
  const short = raw.length > 150 ? raw.slice(0, 150) + '…' : raw;
  return `${context} : ${short}`;
}

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

// ── Normalisation des pays ──────────────────────────────────────────
// Map canonique : nom replié (casse, accents, apostrophes) → libellé français.
// Construite à partir du glossaire ISO 3166-1 ci-dessous, aligné sur la liste
// du formulaire (frontend/src/constants/countries.ts) : c'est la source de
// vérité unique des libellés stockés (les contacts créés manuellement au
// frontend correspondent exactement aux valeurs canoniques du backend).
const COUNTRY_CANONICAL = new Map<string, string>();

export const COUNTRY_FRENCH: [string, string][] = [
  ['AF', 'Afghanistan'], ['AL', 'Albanie'], ['DZ', 'Algérie'], ['AD', 'Andorre'], ['AO', 'Angola'],
  ['AG', 'Antigua-et-Barbuda'], ['AR', 'Argentine'], ['AM', 'Arménie'], ['AU', 'Australie'], ['AT', 'Autriche'],
  ['AZ', 'Azerbaïdjan'], ['BS', 'Bahamas'], ['BH', 'Bahreïn'], ['BD', 'Bangladesh'], ['BB', 'Barbade'],
  ['BY', 'Biélorussie'], ['BE', 'Belgique'], ['BZ', 'Belize'], ['BJ', 'Bénin'], ['BT', 'Bhoutan'],
  ['BO', 'Bolivie'], ['BA', 'Bosnie-Herzégovine'], ['BW', 'Botswana'], ['BR', 'Brésil'], ['BN', 'Brunei'],
  ['BG', 'Bulgarie'], ['BF', 'Burkina Faso'], ['BI', 'Burundi'], ['CV', 'Cap-Vert'], ['KH', 'Cambodge'],
  ['CM', 'Cameroun'], ['CA', 'Canada'], ['CF', 'République centrafricaine'], ['TD', 'Tchad'], ['CL', 'Chili'],
  ['CN', 'Chine'], ['CO', 'Colombie'], ['KM', 'Comores'], ['CG', 'Congo-Brazzaville'], ['CD', 'Congo-Kinshasa (RDC)'],
  ['CR', 'Costa Rica'], ['CI', 'Côte d’Ivoire'], ['HR', 'Croatie'], ['CU', 'Cuba'], ['CY', 'Chypre'],
  ['CZ', 'Tchéquie'], ['DK', 'Danemark'], ['DJ', 'Djibouti'], ['DM', 'Dominique'], ['DO', 'République dominicaine'],
  ['EC', 'Équateur'], ['EG', 'Égypte'], ['SV', 'Salvador'], ['GQ', 'Guinée équatoriale'], ['ER', 'Érythrée'],
  ['EE', 'Estonie'], ['SZ', 'Eswatini'], ['ET', 'Éthiopie'], ['FJ', 'Fidji'], ['FI', 'Finlande'],
  ['FR', 'France'], ['GA', 'Gabon'], ['GM', 'Gambie'], ['GE', 'Géorgie'], ['DE', 'Allemagne'],
  ['GH', 'Ghana'], ['GR', 'Grèce'], ['GD', 'Grenade'], ['GT', 'Guatemala'], ['GN', 'Guinée'],
  ['GW', 'Guinée-Bissau'], ['GY', 'Guyana'], ['HT', 'Haïti'], ['HN', 'Honduras'], ['HU', 'Hongrie'],
  ['IS', 'Islande'], ['IN', 'Inde'], ['ID', 'Indonésie'], ['IR', 'Iran'], ['IQ', 'Irak'],
  ['IE', 'Irlande'], ['IL', 'Israël'], ['IT', 'Italie'], ['JM', 'Jamaïque'], ['JP', 'Japon'],
  ['JO', 'Jordanie'], ['KZ', 'Kazakhstan'], ['KE', 'Kenya'], ['KI', 'Kiribati'], ['KP', 'Corée du Nord'],
  ['KR', 'Corée du Sud'], ['KW', 'Koweït'], ['KG', 'Kirghizistan'], ['LA', 'Laos'], ['LV', 'Lettonie'],
  ['LB', 'Liban'], ['LS', 'Lesotho'], ['LR', 'Libéria'], ['LY', 'Libye'], ['LI', 'Liechtenstein'],
  ['LT', 'Lituanie'], ['LU', 'Luxembourg'], ['MG', 'Madagascar'], ['MW', 'Malawi'], ['MY', 'Malaisie'],
  ['MV', 'Maldives'], ['ML', 'Mali'], ['MT', 'Malte'], ['MH', 'Îles Marshall'], ['MR', 'Mauritanie'],
  ['MU', 'Maurice'], ['MX', 'Mexique'], ['FM', 'Micronésie'], ['MD', 'Moldavie'], ['MC', 'Monaco'],
  ['MN', 'Mongolie'], ['ME', 'Monténégro'], ['MA', 'Maroc'], ['MZ', 'Mozambique'], ['MM', 'Birmanie (Myanmar)'],
  ['NA', 'Namibie'], ['NR', 'Nauru'], ['NP', 'Népal'], ['NL', 'Pays-Bas'], ['NZ', 'Nouvelle-Zélande'],
  ['NI', 'Nicaragua'], ['NE', 'Niger'], ['NG', 'Nigéria'], ['MK', 'Macédoine du Nord'], ['NO', 'Norvège'],
  ['OM', 'Oman'], ['PK', 'Pakistan'], ['PW', 'Palaos'], ['PS', 'Palestine'], ['PA', 'Panama'],
  ['PG', 'Papouasie-Nouvelle-Guinée'], ['PY', 'Paraguay'], ['PE', 'Pérou'], ['PH', 'Philippines'],
  ['PL', 'Pologne'], ['PT', 'Portugal'], ['QA', 'Qatar'], ['RO', 'Roumanie'], ['RU', 'Russie'],
  ['RW', 'Rwanda'], ['KN', 'Saint-Christophe-et-Niévès'], ['LC', 'Sainte-Lucie'], ['VC', 'Saint-Vincent-et-les-Grenadines'],
  ['WS', 'Samoa'], ['SM', 'Saint-Marin'], ['ST', 'Sao Tomé-et-Principe'], ['SA', 'Arabie saoudite'],
  ['SN', 'Sénégal'], ['RS', 'Serbie'], ['SC', 'Seychelles'], ['SL', 'Sierra Leone'], ['SG', 'Singapour'],
  ['SK', 'Slovaquie'], ['SI', 'Slovénie'], ['SB', 'Îles Salomon'], ['SO', 'Somalie'], ['ZA', 'Afrique du Sud'],
  ['SS', 'Soudan du Sud'], ['ES', 'Espagne'], ['LK', 'Sri Lanka'], ['SD', 'Soudan'], ['SR', 'Suriname'],
  ['SE', 'Suède'], ['CH', 'Suisse'], ['SY', 'Syrie'], ['TW', 'Taïwan'], ['TJ', 'Tadjikistan'],
  ['TZ', 'Tanzanie'], ['TH', 'Thaïlande'], ['TL', 'Timor oriental'], ['TG', 'Togo'], ['TO', 'Tonga'],
  ['TT', 'Trinité-et-Tobago'], ['TN', 'Tunisie'], ['TR', 'Turquie'], ['TM', 'Turkménistan'], ['TV', 'Tuvalu'],
  ['UG', 'Ouganda'], ['UA', 'Ukraine'], ['AE', 'Émirats arabes unis'], ['GB', 'Royaume-Uni'],
  ['US', 'États-Unis'], ['UY', 'Uruguay'], ['UZ', 'Ouzbékistan'], ['VU', 'Vanuatu'], ['VA', 'Vatican'], ['VE', 'Venezuela'],
  ['VN', 'Viêt Nam'], ['YE', 'Yémen'], ['ZM', 'Zambie'], ['ZW', 'Zimbabwe'],
];

/** Apostrophes assimilées (guillemets courbe/droit, prime) → apostrophe droite. */
const APOSTROPHE_RE = /[\u2018\u2019\u201A\u201B\u201C\u201D\u0060\u02BC]/g;

/** Replie un nom de pays (casse + accents + apostrophes) avant lookup. */
function foldCountry(value: string): string {
  return foldTerm(value.replace(APOSTROPHE_RE, "'")).trim();
}

for (const [, name] of COUNTRY_FRENCH) {
  COUNTRY_CANONICAL.set(foldCountry(name), name);
}

const COUNTRY_NAME_BY_CODE = new Map(COUNTRY_FRENCH);

/** Nom français replié (casse, accents, apostrophes) → code ISO 3166-1 alpha-2. */
const FRENCH_TO_ISO2 = new Map<string, string>(
  COUNTRY_FRENCH.map(([iso2, name]) => [foldCountry(name), iso2])
);

/**
 * Variantes / anciens libellés de pays → code ISO 3166-1 alpha-2.
 * Récupère les orthographes divergentes stockées avant l'unification du
 * glossaire (anciens libellés backend, saisies manuelles, doublons
 * apostrophe droite/courbe de « Côte d'Ivoire », …).
 */
const COUNTRY_ALIASES: [string, string][] = [
  ['Congo', 'CG'],
  ['Congo-Brazzaville', 'CG'],
  ['République du Congo', 'CG'],
  ['Congo Brazzaville', 'CG'],
  ['Rép. dém. du Congo', 'CD'],
  ['République démocratique du Congo', 'CD'],
  ['Congo; République démocratique du', 'CD'],
  ['Republique Democratique du Congo', 'CD'],
  ['Congo Kinshasa', 'CD'],
  ['RDC', 'CD'],
  ['R D Congo', 'CD'],
  ["Côte d'Ivoire", 'CI'],
  ["Cote d'Ivoire", 'CI'],
  ['Cote dIvoire', 'CI'],
  ["Côte dIvoire", 'CI'],
  ['Cote d ivoire', 'CI'],
  ['Ivory Coast', 'CI'],
  ['République tchèque', 'CZ'],
  ['Czech Republic', 'CZ'],
  ['Rép. dominicaine', 'DO'],
  ['Republica Dominicana', 'DO'],
  ['Birmanie', 'MM'],
  ['Myanmar', 'MM'],
  ['Burma', 'MM'],
  ['San Marin', 'SM'],
  ['Saint Marin', 'SM'],
  ['Antigua-et-Barbude', 'AG'],
  ['España', 'ES'],
  ['Brasil', 'BR'],
  ['Chile', 'CL'],
  ['Mexico', 'MX'],
  ['Nederland', 'NL'],
  ['Deutschland', 'DE'],
  ['United Kingdom', 'GB'],
  ['Great Britain', 'GB'],
  ['United States', 'US'],
  ['USA', 'US'],
  ['Viet Nam', 'VN'],
  ['Vietnam', 'VN'],
  ['ViêtNam', 'VN'],
  ['Viet-Nam', 'VN'],
  ['Veit Nam', 'VN'],
  ['Timor-Leste', 'TL'],
  ['Cabo Verde', 'CV'],
  ['Libya', 'LY'],
  ['Libyan', 'LY'],
  ['Malta', 'MT'],
  ['Ireland', 'IE'],
];

/** Alias (plié) → code ISO 3166-1 alpha-2. */
const ALIAS_TO_ISO2 = new Map<string, string>(
  COUNTRY_ALIASES.map(([alias, iso2]) => [foldCountry(alias), iso2])
);

/** Libellés « non renseigné » → considérés comme vide (stockés NULL). */
const EMPTY_COUNTRY_KEYS = new Set<string>([
  'n/a', 'na', '-', '—', '?', '??', 'unknown', 'inconnu', 'inconnue',
  'indetermine', 'non renseigne', 'non precise', 'nc', 'nsp', 'aucun',
  'aucune', 'vide', 'none', 'null', 'undefined', 'sans', 'sans objet'
]);

/** Nettoyage commun d'un libellé de pays (apostrophes + caractères de contrôle). */
function normalizeCountryInput(raw?: string | null): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  return trimmed
    .replace(APOSTROPHE_RE, "'")
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim();
}

/** Retourne le code ISO alpha-2 d'un nom de pays français (ou null si inconnu). */
export function iso2ForCountry(country?: string | null): string | null {
  const base = normalizeCountryInput(country);
  if (!base) return null;
  if (/^[A-Za-z]{2}$/.test(base)) {
    const code = base.toUpperCase();
    if (COUNTRY_NAME_BY_CODE.has(code)) return code;
  }
  return FRENCH_TO_ISO2.get(foldCountry(base)) ?? ALIAS_TO_ISO2.get(foldCountry(base)) ?? null;
}

/**
 * Normalise un nom de pays vers sa forme canonique :
 *  1. Nettoie les apostrophes et caractères de contrôle.
 *  2. Libellés « non renseigné » (N/A, inconnu, …) → chaîne vide (stockée NULL).
 *  3. Code ISO 3166-1 alpha-2 saisi en dur → libellé français.
 *  4. Lookup canonique puis aliases (repli casse + accents + apostrophes).
 *  5. Pour chaque \uFFFD (caractère corrompu), essaie les 26 lettres a-z.
 *  6. Fallback : valeur nettoyée.
 */
export function normalizeCountry(raw?: string | null): string {
  const base = normalizeCountryInput(raw);
  if (!base) return '';

  const key = foldCountry(base);
  if (EMPTY_COUNTRY_KEYS.has(key)) return '';

  const byCode = countryByIsoCode(base);
  if (byCode) return byCode;

  // Fast path: no replacement characters — canonical ou alias
  if (!base.includes('\uFFFD')) {
    return lookupCountry(key) ?? capitalize(base);
  }

  // Slow path: \uFFFD present — expand each placeholder with a-z and test
  return resolveCorruptedCountry(base, key);
}

function countryByIsoCode(base: string): string | null {
  if (!/^[A-Za-z]{2}$/.test(base)) return null;
  return COUNTRY_NAME_BY_CODE.get(base.toUpperCase()) ?? null;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function lookupCountry(key: string): string | null {
  const canonical = COUNTRY_CANONICAL.get(key);
  if (canonical) return canonical;
  const iso2 = ALIAS_TO_ISO2.get(key);
  if (iso2) return COUNTRY_NAME_BY_CODE.get(iso2) ?? null;
  return null;
}

function resolveCorruptedCountry(base: string, key: string): string {
  const MAX_PLACEHOLDERS = 3;
  const placeholderCount = (base.match(/\uFFFD/g) || []).length;
  if (placeholderCount <= MAX_PLACEHOLDERS) {
    for (const candidate of expandPlaceholders(base)) {
      const found = lookupCountry(foldCountry(candidate));
      if (found) return found;
    }
  }

  // Fallback: strip all \uFFFD and return cleaned
  const stripped = base.replaceAll('\uFFFD', '').trim();
  return capitalize(stripped);
}

/** Replace each \uFFFD with a-z recursively (up to MAX_PLACEHOLDERS). */
function expandPlaceholders(input: string): string[] {
  const idx = input.indexOf('\uFFFD');
  if (idx === -1) return [input];
  const results: string[] = [];
  const before = input.slice(0, idx);
  const after = input.slice(idx + 1);
  for (let c = 97; c <= 122; c++) {
    results.push(...expandPlaceholders(before + String.fromCodePoint(c) + after));
  }
  return results;
}

/** Échappe les jokers LIKE pour une correspondance littérale. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function likePattern(value: string): string {
  return `%${escapeLike(foldTerm(value))}%`;
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
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value) return [value];
  return [];
}

function orCountryOfOrigin(values: string[]): Prisma.Sql {
  const parts = values.map(v => Prisma.sql`"countryOfOrigin" ILIKE ${v}`);
  return Prisma.sql`(${Prisma.join(parts, ' OR ')})`;
}

function orGender(values: string[]): Prisma.Sql {
  const parts = values.map(v => Prisma.sql`"gender" = ${normalizeGender(v)}::"Gender"`);
  return Prisma.sql`(${Prisma.join(parts, ' OR ')})`;
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

/** Construit l'objet `data` d'une mise à jour Prisma à partir d'un payload. */
function buildContactUpdateData(payload: UpdateContactPayload): Record<string, unknown> {
  const dataToUpdate: Record<string, unknown> = {};
  if (payload.firstName !== undefined) dataToUpdate.firstName = clean(payload.firstName) || NA;
  if (payload.lastName !== undefined) dataToUpdate.lastName = clean(payload.lastName) || NA;
  if (payload.email !== undefined) dataToUpdate.email = payload.email.toLowerCase().trim();
  if (payload.gender !== undefined) dataToUpdate.gender = normalizeGender(payload.gender);
  if (payload.countryOfOrigin !== undefined) dataToUpdate.countryOfOrigin = normalizeCountry(payload.countryOfOrigin) || null;
  if (payload.city !== undefined) dataToUpdate.city = clean(payload.city) || null;
  if (payload.phone !== undefined) dataToUpdate.phone = clean(payload.phone) || null;
  if (payload.affiliation !== undefined) dataToUpdate.affiliation = clean(payload.affiliation) || null;
  if (payload.function !== undefined) dataToUpdate.function = clean(payload.function) || null;
  if (payload.experience !== undefined) dataToUpdate.experience = clean(payload.experience) || null;
  if (payload.facultyDepartment !== undefined) dataToUpdate.facultyDepartment = clean(payload.facultyDepartment) || null;
  if (payload.researchCareerStage !== undefined) dataToUpdate.researchCareerStage = normalizeCareerStage(payload.researchCareerStage);
  if (payload.avatarUrl !== undefined) dataToUpdate.avatarUrl = clean(payload.avatarUrl) || null;
  return dataToUpdate;
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
      const idParts = ids.map(id => Prisma.sql`${id}`);
      return [Prisma.sql`"id" IN (${Prisma.join(idParts)})`];
    }
    return this.buildWhereConditions(params);
  }

  private whereSql(conditions: Prisma.Sql[]): Prisma.Sql {
    return conditions.length ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}` : Prisma.empty;
  }

  public async getContacts(params: QueryContactsParams) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(10000, params.limit || 20));
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
      lastId = idRows.at(-1)!.id;
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

  /** Matérialise toutes les lignes de l'export (XLSX / JSON). */
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
        countryOfOrigin: normalizeCountry(payload.countryOfOrigin) || null,
        city: clean(payload.city) || null,
        phone: clean(payload.phone) || null,
        affiliation: clean(payload.affiliation) || null,
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

    const dataToUpdate = buildContactUpdateData(payload);

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

  public async bulkDelete(ids: string[]) {
    // deleteMany ignore silencieusement les identifiants inexistants :
    // on renvoie le nombre réellement supprimé pour un retour fidèle.
    const result = await prisma.contact.deleteMany({
      where: { id: { in: ids } }
    });
    return { success: true, deletedCount: result.count };
  }

  /**
   * Bulk-create / update contacts inside a single Prisma interactive
   * transaction.  On failure the entire batch is rolled back so no partial
   * writes leak through.
   *
   * tagIds: when supplied on a new or updated payload the corresponding
   *         ContactTag rows are created inside the same transaction.
   *         Tags are synced idempotently: existing tags are kept, only
   *         missing tags are added and extra tags are removed.
   */
  public async bulkSave(newContactsPayloads: CreateContactPayload[], updatedContactsPayloads: Array<{ id: string } & UpdateContactPayload>) {
    return await prisma.$transaction(async (tx) => {
      const errors: Array<{ row: number; message: string }> = [];

      // ── Step 1: Resolve emails and pre-fetch existing contacts (1 query) ──
      const existingByEmail = await this.loadExistingByEmail(tx, newContactsPayloads);

      // ── Step 1b: Validate tagIds — discard any that don't exist in DB ──
      const validTagIds = await this.resolveValidTagIds(tx, newContactsPayloads, updatedContactsPayloads);

      // ── Step 2: Partition new payloads into creates vs updates ──
      const emailsToTagIds = new Map<string, string[]>();
      const createPayloads = this.partitionCreatePayloads(newContactsPayloads, existingByEmail, validTagIds, emailsToTagIds);

      // ── Step 3: Bulk create (1 query), fallback row-by-row ──
      const createdCount = await this.createBulkContacts(tx, createPayloads, existingByEmail, errors);

      // ── Step 4: Bulk update existing contacts (chunked parallel) ──
      const ops = await this.collectUpdateOps(tx, updatedContactsPayloads, validTagIds, emailsToTagIds, errors);
      await this.executeUpdateOps(tx, ops.updateOps, errors);

      // ── Step 4b: Tags des contacts « new » déjà présents en base ──
      this.registerExistingNewPayloadTags(newContactsPayloads, existingByEmail, validTagIds, emailsToTagIds);

      // ── Step 5: Idempotent tag sync (2 queries) ──
      await this.syncTags(tx, emailsToTagIds, existingByEmail);

      return { createdCount, updatedCount: ops.updatedCount, errors };
    }, { maxWait: 15000, timeout: 60000 });
  }

  private async loadExistingByEmail(
    tx: Prisma.TransactionClient,
    newContactsPayloads: CreateContactPayload[]
  ): Promise<Map<string, string>> {
    const resolvedEmails = newContactsPayloads.map(p => resolveEmail(p.email));
    const allExistingRows = await tx.contact.findMany({
      where: { email: { in: resolvedEmails } },
      select: { id: true, email: true }
    });
    return new Map(allExistingRows.map(r => [r.email, r.id]));
  }

  private async resolveValidTagIds(
    tx: Prisma.TransactionClient,
    newContactsPayloads: CreateContactPayload[],
    updatedContactsPayloads: Array<{ id: string } & UpdateContactPayload>
  ): Promise<Set<string>> {
    const allTagIds = new Set<string>();
    for (const p of [...newContactsPayloads, ...updatedContactsPayloads]) {
      if (p.tagIds) p.tagIds.forEach(id => allTagIds.add(id));
    }
    if (allTagIds.size === 0) return new Set();
    const existingTags = await tx.tag.findMany({
      where: { id: { in: Array.from(allTagIds) } },
      select: { id: true }
    });
    return new Set(existingTags.map(t => t.id));
  }

  private keepValidTagIds(tagIds: string[], validTagIds: Set<string>): string[] {
    return tagIds.filter(id => validTagIds.has(id));
  }

  private buildContactCreateData(payload: CreateContactPayload, emailClean: string, names: { firstName: string; lastName: string }): any {
    return {
      firstName: names.firstName,
      lastName: names.lastName,
      email: emailClean,
      gender: normalizeGender(payload.gender),
      countryOfOrigin: normalizeCountry(payload.countryOfOrigin) || null,
      city: clean(payload.city) || null,
      phone: clean(payload.phone) || null,
      affiliation: clean(payload.affiliation) || null,
      function: clean(payload.function) || null,
      experience: clean(payload.experience) || null,
      facultyDepartment: clean(payload.facultyDepartment) || null,
      researchCareerStage: normalizeCareerStage(payload.researchCareerStage),
      avatarUrl: clean(payload.avatarUrl) || null
    };
  }

  private partitionCreatePayloads(
    newContactsPayloads: CreateContactPayload[],
    existingByEmail: Map<string, string>,
    validTagIds: Set<string>,
    emailsToTagIds: Map<string, string[]>
  ): any[] {
    const createPayloads: any[] = [];
    for (const payload of newContactsPayloads) {
      const emailClean = resolveEmail(payload.email);
      const names = resolveNames(payload);

      if (payload.tagIds && payload.tagIds.length > 0) {
        emailsToTagIds.set(emailClean, this.keepValidTagIds(payload.tagIds, validTagIds));
      }

      // Already in DB → will be handled by the tag-sync step below
      if (existingByEmail.has(emailClean)) {
        continue;
      }

      createPayloads.push(this.buildContactCreateData(payload, emailClean, names));
      // Register so within-batch duplicates become updates
      existingByEmail.set(emailClean, '__pending__');
    }
    return createPayloads;
  }

  private async createBulkContacts(
    tx: Prisma.TransactionClient,
    createPayloads: any[],
    existingByEmail: Map<string, string>,
    errors: Array<{ row: number; message: string }>
  ): Promise<number> {
    if (createPayloads.length === 0) return 0;

    let createdCount = 0;
    try {
      await tx.contact.createMany({ data: createPayloads, skipDuplicates: true });
      createdCount = createPayloads.length;
    } catch {
      // If the entire batch fails, fall back to row-by-row for creates
      for (let i = 0; i < createPayloads.length; i++) {
        try {
          await tx.contact.create({ data: createPayloads[i] });
          createdCount++;
        } catch (rowErr: any) {
          errors.push({ row: i + 1, message: friendlyRowError(rowErr, `Ligne ${i + 1} (création ${createPayloads[i].email})`) });
        }
      }
    }

    // Fetch back to get IDs for tag assignment
    const createdRows = await tx.contact.findMany({
      where: { email: { in: createPayloads.map(p => p.email) } },
      select: { id: true, email: true }
    });
    for (const r of createdRows) {
      existingByEmail.set(r.email, r.id);
    }
    return createdCount;
  }

  private async collectUpdateOps(
    tx: Prisma.TransactionClient,
    updatedContactsPayloads: Array<{ id: string } & UpdateContactPayload>,
    validTagIds: Set<string>,
    emailsToTagIds: Map<string, string[]>,
    errors: Array<{ row: number; message: string }>
  ): Promise<{ updateOps: Array<{ id: string; data: any }>; updatedCount: number }> {
    const updateOps: Array<{ id: string; data: any }> = [];
    const updateItems = updatedContactsPayloads.filter(u => u.id);
    let updatedCount = 0;

    for (let i = 0; i < updateItems.length; i++) {
      const item = updateItems[i];
      try {
        const row = await tx.contact.findUnique({ where: { id: item.id }, select: { id: true } });
        if (!row) {
          errors.push({ row: i + 1, message: `Contact ${item.id} non trouvé` });
          continue;
        }

        const dataToUpdate = buildContactUpdateData(item);
        if (Object.keys(dataToUpdate).length > 0) {
          updateOps.push({ id: item.id, data: dataToUpdate });
        }

        if (item.tagIds && item.tagIds.length > 0) {
          emailsToTagIds.set(item.email.toLowerCase().trim(), this.keepValidTagIds(item.tagIds, validTagIds));
        }
        updatedCount++;
      } catch (rowErr: any) {
        errors.push({ row: i + 1, message: friendlyRowError(rowErr, `Ligne ${i + 1} (mise à jour ${item.id})`) });
      }
    }

    return { updateOps, updatedCount };
  }

  private async executeUpdateOps(
    tx: Prisma.TransactionClient,
    updateOps: Array<{ id: string; data: any }>,
    errors: Array<{ row: number; message: string }>
  ): Promise<void> {
    // Execute updates in chunks of 50 for parallelism
    const BATCH = 50;
    for (let i = 0; i < updateOps.length; i += BATCH) {
      const chunk = updateOps.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        chunk.map(op => tx.contact.update({ where: { id: op.id }, data: op.data }))
      );
      for (let j = 0; j < results.length; j++) {
        if (results[j].status === 'rejected') {
          const reason = (results[j] as PromiseRejectedResult).reason;
          errors.push({ row: i + j + 1, message: friendlyRowError(reason, `Ligne ${i + j + 1} (mise à jour)`) });
        }
      }
    }
  }

  private registerExistingNewPayloadTags(
    newContactsPayloads: CreateContactPayload[],
    existingByEmail: Map<string, string>,
    validTagIds: Set<string>,
    emailsToTagIds: Map<string, string[]>
  ): void {
    // Tags pour les contacts « new » qui étaient déjà en base
    for (const payload of newContactsPayloads) {
      const emailClean = resolveEmail(payload.email);
      const contactId = existingByEmail.get(emailClean);
      if (contactId && contactId !== '__pending__' && payload.tagIds && payload.tagIds.length > 0) {
        emailsToTagIds.set(emailClean, this.keepValidTagIds(payload.tagIds, validTagIds));
      }
    }
  }

  private groupContactTags(existingTags: Array<{ contactId: string; tagId: string }>): Map<string, Set<string>> {
    const existingTagSet = new Map<string, Set<string>>();
    for (const t of existingTags) {
      if (!existingTagSet.has(t.contactId)) existingTagSet.set(t.contactId, new Set());
      existingTagSet.get(t.contactId)!.add(t.tagId);
    }
    return existingTagSet;
  }

  private computeTagDiffs(
    allTagEmails: string[],
    emailsToTagIds: Map<string, string[]>,
    existingByEmail: Map<string, string>,
    existingTagSet: Map<string, Set<string>>
  ): { tagsToAdd: Array<{ contactId: string; tagId: string }>; tagsToRemove: Array<{ contactId: string; tagId: string }> } {
    const tagsToAdd: Array<{ contactId: string; tagId: string }> = [];
    const tagsToRemove: Array<{ contactId: string; tagId: string }> = [];

    for (const email of allTagEmails) {
      const contactId = existingByEmail.get(email)!;
      const desired = new Set(emailsToTagIds.get(email) || []);
      const existing = existingTagSet.get(contactId) || new Set();

      // Add tags that are desired but not existing
      for (const tagId of desired) {
        if (!existing.has(tagId)) {
          tagsToAdd.push({ contactId, tagId });
        }
      }
      // Remove tags that exist but are not desired
      for (const tagId of existing) {
        if (!desired.has(tagId)) {
          tagsToRemove.push({ contactId, tagId });
        }
      }
    }

    return { tagsToAdd, tagsToRemove };
  }

  private async syncTags(
    tx: Prisma.TransactionClient,
    emailsToTagIds: Map<string, string[]>,
    existingByEmail: Map<string, string>
  ): Promise<void> {
    const allTagEmails = Array.from(emailsToTagIds.keys()).filter(e => existingByEmail.get(e) && existingByEmail.get(e) !== '__pending__');
    const allContactIds = allTagEmails.map(e => existingByEmail.get(e)!).filter(Boolean);
    if (allContactIds.length === 0) return;

    // Fetch existing tag associations (1 query)
    const existingTags = await tx.tagOnContact.findMany({
      where: { contactId: { in: allContactIds } },
      select: { contactId: true, tagId: true }
    });
    const existingTagSet = this.groupContactTags(existingTags);

    const { tagsToAdd, tagsToRemove } = this.computeTagDiffs(allTagEmails, emailsToTagIds, existingByEmail, existingTagSet);

    // Batch write (≤2 queries)
    if (tagsToAdd.length > 0) {
      await tx.tagOnContact.createMany({ data: tagsToAdd, skipDuplicates: true });
    }
    if (tagsToRemove.length > 0) {
      // Delete each stale tag pair — Prisma has no bulk delete by composite key,
      // so we batch by contactId groups
      const byContact = new Map<string, string[]>();
      for (const t of tagsToRemove) {
        if (!byContact.has(t.contactId)) byContact.set(t.contactId, []);
        byContact.get(t.contactId)!.push(t.tagId);
      }
      const removeChunks: Array<Promise<any>> = [];
      for (const [contactId, tagIds] of byContact) {
        removeChunks.push(
          tx.tagOnContact.deleteMany({
            where: { contactId, tagId: { in: tagIds } }
          })
        );
      }
      await Promise.all(removeChunks);
    }
  }

  /** Replace all TagOnContact rows for a contact within the given tx client. */
  private async syncContactTags(tx: Prisma.TransactionClient, contactId: string, tagIds: string[]) {
    await tx.tagOnContact.deleteMany({ where: { contactId } });
    for (const tagId of tagIds) {
      await tx.tagOnContact.create({ data: { contactId, tagId } });
    }
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
        status: previewRowStatus(isValid, isDuplicate),
        existingContactId: existingId,
        message: previewRowMessage(isValid, isDuplicate)
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
