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
