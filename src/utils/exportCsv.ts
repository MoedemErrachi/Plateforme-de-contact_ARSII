import { CAREER_STAGE_LABELS, Contact, GENDER_LABELS } from '../types';

export type FieldKey =
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

export const FIELD_LABELS: { key: FieldKey; label: string }[] = [
  { key: 'email', label: 'Adresse Email' },
  { key: 'firstName', label: 'Prénom' },
  { key: 'lastName', label: 'Nom' },
  { key: 'gender', label: 'Genre' },
  { key: 'countryOfOrigin', label: "Pays d'origine" },
  { key: 'city', label: 'Ville' },
  { key: 'phone', label: 'Téléphone' },
  { key: 'affiliation', label: 'Affiliation' },
  { key: 'function', label: 'Fonction' },
  { key: 'experience', label: 'Expérience' },
  { key: 'facultyDepartment', label: 'Faculté / Département' },
  { key: 'researchCareerStage', label: 'Stade de carrière' }
];

export const FIELD_HEADERS: Record<FieldKey, string> = {
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

export interface CsvBuildOptions {
  fields?: Record<FieldKey, boolean>;
  includeTags?: boolean;
}

function getCellValue(c: Contact, key: FieldKey): string {
  switch (key) {
    case 'gender':
      return GENDER_LABELS[c.gender] || c.gender;
    case 'researchCareerStage':
      return CAREER_STAGE_LABELS[c.researchCareerStage] || c.researchCareerStage;
    case 'firstName':
      return c.firstName || '';
    case 'lastName':
      return c.lastName || '';
    default:
      return String((c as unknown as Record<string, unknown>)[key] || '');
  }
}

export function buildContactsCsv(contacts: Contact[], options: CsvBuildOptions = {}): string {
  const { includeTags = false, fields } = options;
  const activeKeys = FIELD_LABELS.filter(f => !fields || fields[f.key]).map(f => f.key);
  const headers = activeKeys.map(k => FIELD_HEADERS[k]);
  if (includeTags) headers.push('Étiquettes / Tags');

  const rows = [headers.join(',')];
  contacts.forEach(c => {
    const cells = activeKeys.map(k => `"${getCellValue(c, k).replace(/"/g, '""')}"`);
    if (includeTags) cells.push(`"${((c.tags || []).join('; ')).replace(/"/g, '""')}"`);
    rows.push(cells.join(','));
  });
  return rows.join('\n');
}

export function downloadCsv(content: string, fileName: string): void {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadContactsCsv(contacts: Contact[], fileName: string, options: CsvBuildOptions = {}): void {
  downloadCsv(buildContactsCsv(contacts, options), fileName);
}
