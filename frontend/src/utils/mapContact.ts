import { Contact } from '../types';
import { formatFullName } from './format';

export function mapContactFromApi(c: any): Contact {
  const firstName = (c.firstName || '').trim();
  const lastName = (c.lastName || '').trim();
  const name = formatFullName(firstName, lastName);
  const firstInit = firstName && firstName !== 'N/A' ? firstName[0] : '';
  const lastInit = lastName && lastName !== 'N/A' ? lastName[0] : '';
  return {
    ...c,
    firstName,
    lastName,
    name,
    initials: `${firstInit}${lastInit}`.toUpperCase() || c.initials || 'NC',
    gender: c.gender === 'MALE' ? 'MALE' : c.gender === 'FEMALE' ? 'FEMALE' : 'NOT_SPECIFIED',
    researchCareerStage: c.researchCareerStage || 'R1_FIRST_STAGE',
    countryOfOrigin: c.countryOfOrigin || '',
    city: c.city ?? null,
    phone: c.phone ?? null,
    affiliation: c.affiliation || '',
    tags: Array.isArray(c.tags)
      ? c.tags.map((t: any) => t.tag?.name ?? t.name ?? t)
      : []
  };
}
