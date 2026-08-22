import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './authenticateJWT';

export function authorizeRole(...allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user?.role || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Accès refusé. Privilèges insuffisants.',
        code: 'FORBIDDEN'
      });
    }
    next();
  };
}

// Rangs de privilège : READ (lecture seule) < READ_WRITE (création/édition) < FULL_ACCESS (suppression).
const PRIVILEGE_RANKS: Record<string, number> = {
  READ: 1,
  READ_WRITE: 2,
  FULL_ACCESS: 3
};

export type RequiredPrivilege = keyof typeof PRIVILEGE_RANKS;

/**
 * Restreint une route au niveau de privilège minimum requis.
 * - Les administrateurs passent toujours (leurs droits couvrent tout le back-office).
 * - Le privilège est relu depuis la base par authenticateJWT : une révocation
 *   s'applique à la requête suivante, sans reconnexion.
 */
export function requirePrivilege(minimum: RequiredPrivilege) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const role = req.user?.role;
    if (role === 'admin') {
      return next();
    }

    const userPrivilege = req.user?.privilege;
    const userRank = userPrivilege ? PRIVILEGE_RANKS[userPrivilege] : undefined;

    if (!userRank || userRank < PRIVILEGE_RANKS[minimum]) {
      return res.status(403).json({
        error: 'Accès refusé. Votre niveau d\'accès ne permet pas cette action.',
        code: 'FORBIDDEN'
      });
    }
    next();
  };
}
