import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'arsii-crm-super-secret-jwt-key-2026';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

export function authenticateJWT(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // Extract token from HttpOnly cookie first, or fallback to Authorization Bearer header
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
    };

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ 
      error: 'Jeton invalide ou expiré.',
      code: 'INVALID_TOKEN' 
    });
  }
}

// Export auth helper to set HttpOnly + SameSite=Strict cookies
export function setAuthCookie(res: Response, payload: { id: string; email: string; name: string; role: string }) {
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });

  res.cookie('accessToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 8 * 60 * 60 * 1000 // 8 hours
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
