import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma';

/* v8 ignore start -- Garde-fou de démarrage : `process.exit` ne peut pas être exercé sans détruire le worker de test ; couvert au démarrage réel (JWT_SECRET toujours défini). */
if (!process.env.JWT_SECRET) {
  console.error('[FATAL] JWT_SECRET environment variable is not set. Refusing to start with an insecure fallback.');
  process.exit(1);
}
/* v8 ignore stop */

const JWT_SECRET = process.env.JWT_SECRET;

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
    privilege?: string;
    tokenVersion?: number;
  };
}

export function authenticateJWT(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.accessToken ||
                req.cookies?.token ||
                req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      error: 'Accès refusé. Jeton d\'authentification manquant.',
      code: 'UNAUTHORIZED'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      email: string;
      name: string;
      role: string;
      tokenVersion?: number;
    };

    if (decoded.tokenVersion === undefined) {
      return res.status(401).json({
        error: 'Session expirée. Veuillez vous reconnecter.',
        code: 'TOKEN_VERSION_MISSING'
      });
    }

    prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, tokenVersion: true, role: true, privilege: true }
    })
      .then((dbUser) => {
        if (!dbUser) {
          return res.status(401).json({
            error: 'Session invalide. Utilisateur introuvable.',
            code: 'INVALID_SESSION'
          });
        }

        if (decoded.tokenVersion !== dbUser.tokenVersion) {
          return res.status(401).json({
            error: 'Session expirée. Veuillez vous reconnecter.',
            code: 'TOKEN_VERSION_MISMATCH'
          });
        }

        // Le rôle et le privilège sont relus depuis la base à chaque requête :
        // un changement de droits par l'admin s'applique immédiatement,
        // sans attendre le renouvellement du JWT.
        req.user = { ...decoded, role: String(dbUser.role).toLowerCase(), privilege: dbUser.privilege };
        next();
      })
      .catch((err) => {
        console.error('[authenticateJWT] DB session check failed:', err);
        return res.status(503).json({
          error: 'Service temporairement indisponible. Réessayez plus tard.',
          code: 'SERVICE_UNAVAILABLE'
        });
      });
  } catch {
    return res.status(403).json({
      error: 'Jeton invalide ou expiré.',
      code: 'INVALID_TOKEN'
    });
  }
}

// Export auth helper to set HttpOnly + SameSite=Strict cookies
export function setAuthCookie(res: Response, payload: { id: string; email: string; name: string; role: string; tokenVersion?: number }, rememberMe?: boolean) {
  // « Se souvenir de moi » : 7 jours ; session standard : 8 heures ouvrées.
  const maxAge = rememberMe ? 7 * 24 * 60 * 60 * 1000 : 8 * 60 * 60 * 1000;
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: rememberMe ? '7d' : '8h' });

  res.cookie('accessToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge
  });

  return token;
}

export function clearAuthCookie(res: Response) {
  res.clearCookie('accessToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });
}
