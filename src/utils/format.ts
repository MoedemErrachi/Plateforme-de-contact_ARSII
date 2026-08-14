export const NAME_FALLBACK = 'N/A';

export function formatFullName(firstName?: string | null, lastName?: string | null): string {
  const cleanFirst = (!firstName || firstName.trim() === 'N/A') ? '' : firstName.trim();
  const cleanLast = (!lastName || lastName.trim() === 'N/A') ? '' : lastName.trim();

  const fullName = `${cleanFirst} ${cleanLast}`.trim();

  return fullName.length > 0 ? fullName : 'N/A';
}

export function splitFullName(fullName?: string | null): { firstName: string; lastName: string } {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}
