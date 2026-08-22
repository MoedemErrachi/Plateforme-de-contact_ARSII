import { User, Privilege } from '../types';

/**
 * Matrice de privilèges (3 niveaux) côté client :
 * - READ        : consultation seule — aucune action d'écriture n'est affichée.
 * - READ_WRITE  : création et édition autorisées — les suppressions sont masquées.
 * - FULL_ACCESS : toutes les actions.
 * Les administrateurs disposent implicitement de tous les droits.
 */
const PRIVILEGE_RANKS: Record<Privilege, number> = {
  READ: 1,
  READ_WRITE: 2,
  FULL_ACCESS: 3
};

export function effectivePrivilege(user: User | null): Privilege {
  if (!user) return 'READ';
  if (user.role === 'admin') return 'FULL_ACCESS';
  return user.privilege || 'FULL_ACCESS';
}

function hasAtLeast(user: User | null, minimum: Privilege): boolean {
  return PRIVILEGE_RANKS[effectivePrivilege(user)] >= PRIVILEGE_RANKS[minimum];
}

export function canCreate(user: User | null): boolean {
  return hasAtLeast(user, 'READ_WRITE');
}

export function canEdit(user: User | null): boolean {
  return hasAtLeast(user, 'READ_WRITE');
}

export function canDelete(user: User | null): boolean {
  return hasAtLeast(user, 'FULL_ACCESS');
}

export const PRIVILEGE_LABELS: Record<Privilege, string> = {
  READ: 'Lecture seule',
  READ_WRITE: 'Lecture / Écriture',
  FULL_ACCESS: 'Accès complet'
};
